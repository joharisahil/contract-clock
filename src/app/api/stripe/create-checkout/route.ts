import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getStripe, PLAN_PRICES } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/supabase/queries";
import type { PlanType } from "@/types";

const schema = z.object({
  plan: z.enum(["free", "starter", "pro", "business", "agency"]),
  interval: z.enum(["monthly", "yearly"]),
});

function getPriceId(plan: Exclude<PlanType, "free">, interval: "monthly" | "yearly") {
  const key = `${plan}_${interval}` as keyof typeof PLAN_PRICES;
  return PLAN_PRICES[key];
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (parsed.data.plan === "free") {
    return NextResponse.json({ error: "Free plan does not require checkout" }, { status: 400 });
  }

  const organization = await getOrganization(supabase, user.id).catch(() => null);

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const priceId = getPriceId(parsed.data.plan, parsed.data.interval);

  if (!priceId) {
    return NextResponse.json({ error: "Missing Stripe price configuration" }, { status: 500 });
  }

  let customerId = organization.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name:
        typeof user.user_metadata.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata.name === "string"
            ? user.user_metadata.name
            : undefined,
      metadata: {
        organization_id: organization.id,
        owner_id: user.id,
      },
    });

    customerId = customer.id;

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", organization.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_email: user.email ?? undefined,
    allow_promotion_codes: true,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        organization_id: organization.id,
        plan: parsed.data.plan,
        interval: parsed.data.interval,
      },
    },
    metadata: {
      organization_id: organization.id,
      plan: parsed.data.plan,
      interval: parsed.data.interval,
    },
    success_url: `${appUrl}/dashboard?upgraded=true`,
    cancel_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
