import { NextResponse } from "next/server";
import { z } from "zod";

const contractSchema = z.object({
  title: z.string().min(1),
  counterparty: z.string().min(1),
  value: z.number().nonnegative().optional(),
});

export async function GET() {
  return NextResponse.json({
    data: [],
    message: "Contracts endpoint ready.",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = contractSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      data: parsed.data,
      message: "Contract payload validated successfully.",
    },
    { status: 201 },
  );
}
