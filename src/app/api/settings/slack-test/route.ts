import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendSlackNotification } from "@/lib/slack";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  webhookUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
  }

  await sendSlackNotification(parsed.data.webhookUrl, {
    vendorName: "Sample renewal",
    daysUntilRenewal: 21,
    annualCost: 2400,
    currency: "USD",
    contractUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/contracts`,
  });

  return NextResponse.json({ ok: true });
}
