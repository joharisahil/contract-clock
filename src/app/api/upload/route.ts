import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are allowed" },
      { status: 400 },
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 10MB" },
      { status: 400 },
    );
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${user.id}/${Date.now()}-${sanitizedName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("contracts")
    .upload(filePath, new Uint8Array(bytes), {
      contentType: "application/pdf",
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("contracts")
    .getPublicUrl(filePath);

  const pdfUrl = urlData.publicUrl;

  let extractedText = "";
  try {
    const pdfParseModule = await import("pdf-parse");
    const buffer = Buffer.from(bytes);
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    extractedText = pdfData.text?.slice(0, 8000) ?? "";
    await parser.destroy();
  } catch (err) {
    console.error("PDF text extraction failed:", err);
    return NextResponse.json({ url: pdfUrl, path: filePath, extraction: null });
  }

  let extraction = null;

  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (geminiApiKey && extractedText) {
    try {
      const prompt = `Extract contract information from this document text and return ONLY a valid JSON object with no markdown, no backticks, no explanation:
{
  "vendor_name": "string or null",
  "annual_cost": "number or null",
  "currency": "GBP or USD or CAD or null",
  "start_date": "YYYY-MM-DD or null",
  "renewal_date": "YYYY-MM-DD or null",
  "notice_period_days": "number or null",
  "auto_renewal": "true or false or null",
  "contract_type": "software_subscription or vendor_service or office_lease or equipment_lease or insurance or freelancer_retainer or professional_membership or other or null",
  "confidence": {
    "vendor_name": "high or medium or low",
    "annual_cost": "high or medium or low",
    "renewal_date": "high or medium or low",
    "contract_type": "high or medium or low"
  }
}

Document text:
${extractedText}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000,
            },
          }),
        },
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawText =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleaned = rawText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        extraction = JSON.parse(cleaned);
      }
    } catch (err) {
      console.error("Gemini extraction failed:", err);
      extraction = null;
    }
  }

  return NextResponse.json({
    url: pdfUrl,
    path: filePath,
    extraction,
  });
}
