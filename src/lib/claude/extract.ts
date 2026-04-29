import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { ContractAIExtractionData } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const extractionSchema = z.object({
  vendor_name: z.string().nullable(),
  annual_cost: z.number().nullable(),
  currency: z.enum(["GBP", "USD", "CAD"]).nullable(),
  start_date: z.string().nullable(),
  renewal_date: z.string().nullable(),
  notice_period_days: z.number().nullable(),
  auto_renewal: z.boolean().nullable(),
  contract_type: z
    .enum([
      "software_subscription",
      "vendor_service",
      "office_lease",
      "equipment_lease",
      "insurance",
      "freelancer_retainer",
      "professional_membership",
      "other",
    ])
    .nullable(),
  confidence: z.object({
    vendor_name: z.enum(["high", "medium", "low"]),
    annual_cost: z.enum(["high", "medium", "low"]),
    currency: z.enum(["high", "medium", "low"]),
    start_date: z.enum(["high", "medium", "low"]),
    renewal_date: z.enum(["high", "medium", "low"]),
    notice_period_days: z.enum(["high", "medium", "low"]),
    auto_renewal: z.enum(["high", "medium", "low"]),
    contract_type: z.enum(["high", "medium", "low"]),
  }),
});

const contractExtractionSystemPrompt = `You are a contract data extractor. Extract the following information from this contract document and return ONLY a JSON object with no other text:
{
  vendor_name: string or null,
  annual_cost: number or null (in original currency),
  currency: 'GBP' or 'USD' or 'CAD' or null,
  start_date: 'YYYY-MM-DD' or null,
  renewal_date: 'YYYY-MM-DD' or null,
  notice_period_days: number or null,
  auto_renewal: boolean or null,
  contract_type: one of [software_subscription, vendor_service, office_lease, equipment_lease, insurance, freelancer_retainer, professional_membership, other] or null,
  confidence: object with each field rated 'high', 'medium', or 'low'
}
If you cannot find a value, use null. For dates, look for renewal date, expiry date, end date, or anniversary date.`;

function extractJsonFromContent(content: string) {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return content.trim();
}

export async function extractContractDataWithClaude(
  documentText: string,
): Promise<ContractAIExtractionData> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: contractExtractionSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Extract contract data from this document:\n\n${documentText}`,
      },
    ],
  });

  const textContent = response.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n")
    .trim();

  const parsed = extractionSchema.safeParse(
    JSON.parse(extractJsonFromContent(textContent)),
  );

  if (!parsed.success) {
    throw new Error("Claude returned an invalid extraction payload.");
  }

  return parsed.data;
}
