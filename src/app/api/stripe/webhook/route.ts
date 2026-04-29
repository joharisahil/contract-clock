import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { formatISO } from "date-fns";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { sendBillingStatusEmail, sendTrialEndingEmail } from "@/lib/resend";
import { getStripe, PLAN_PRICES } from "@/lib/stripe/client";
import { PLAN_CONTRACT_LIMITS } from "@/lib/stripe/constants";
import type { Organization, PlanType, Profile } from "@/types";

type OrganizationRecord = Organization;
type ProfileRecord = Pick<Profile, "id" | "email" | "full_name">;

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

function planFromPriceId(priceId: string | null | undefined): PlanType {
  const entries = Object.entries(PLAN_PRICES) as Array<
    [keyof typeof PLAN_PRICES, string]
  >;
  const matched = entries.find(([, id]) => id && id === priceId)?.[0];

  if (!matched) {
    return "free";
  }

  if (matched.startsWith("starter")) return "starter";
  if (matched.startsWith("pro")) return "pro";
  if (matched.startsWith("business")) return "business";
  if (matched.startsWith("agency")) return "agency";
  return "free";
}

async function getOrganizationByCustomerId(customerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as OrganizationRecord | null) ?? null;
}

async function getOwnerProfile(ownerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", ownerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRecord | null) ?? null;
}

async function updateOrganizationForSubscription(
  organizationId: string,
  subscription: Stripe.Subscription,
) {
  const plan = planFromPriceId(subscription.items.data[0]?.price.id);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      plan,
      stripe_subscription_id: subscription.id,
      trial_ends_at: subscription.trial_end
        ? formatISO(new Date(subscription.trial_end * 1000), {
            representation: "date",
          })
        : null,
      contract_limit: PLAN_CONTRACT_LIMITS[plan],
    })
    .eq("id", organizationId);

  if (error) {
    throw error;
  }

  return plan;
}

async function downgradeOrganizationToFree(organizationId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      plan: "free",
      stripe_subscription_id: null,
      contract_limit: PLAN_CONTRACT_LIMITS.free,
    })
    .eq("id", organizationId);

  if (error) {
    throw error;
  }
}

async function sendPastDueWarning(organization: OrganizationRecord) {
  const owner = await getOwnerProfile(organization.owner_id);

  if (!owner?.email) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await sendBillingStatusEmail(owner.email, {
    preview: "Your subscription is past due",
    heading: "Your ContractClock subscription is past due",
    body: `We couldn't confirm your latest subscription payment for ${organization.name}.\n\nUpdate your payment method soon to avoid any interruption.`,
    ctaLabel: "Manage billing",
    ctaUrl: `${appUrl}/settings/billing`,
  });
}

async function sendCancellationEmail(organization: OrganizationRecord) {
  const owner = await getOwnerProfile(organization.owner_id);

  if (!owner?.email) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await sendBillingStatusEmail(owner.email, {
    preview: "Your subscription has been cancelled",
    heading: "Your ContractClock subscription was cancelled",
    body: `Your workspace ${organization.name} has been downgraded to the free plan.\n\nYou can resubscribe anytime to restore higher limits and billing features.`,
    ctaLabel: "Resubscribe",
    ctaUrl: `${appUrl}/settings/billing`,
  });
}

async function sendPaymentFailedEmail(customerId: string) {
  const organization = await getOrganizationByCustomerId(customerId);

  if (!organization) {
    return;
  }

  const owner = await getOwnerProfile(organization.owner_id);

  if (!owner?.email) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await sendBillingStatusEmail(owner.email, {
    preview: "Payment failed for your ContractClock subscription",
    heading: "Payment failed",
    body: `We couldn't process your latest payment for ${organization.name}.\n\nUpdate your payment method to keep your subscription active.`,
    ctaLabel: "Update payment method",
    ctaUrl: `${appUrl}/settings/billing`,
  });
}

async function sendTrialWillEndEmail(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const organization = await getOrganizationByCustomerId(customerId);

  if (!organization || !subscription.trial_end) {
    return;
  }

  const owner = await getOwnerProfile(organization.owner_id);

  if (!owner?.email) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const daysLeft = Math.max(
    0,
    Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  await sendTrialEndingEmail(owner.email, {
    userName: owner.full_name ?? owner.email,
    daysLeft,
    upgradeUrl: `${appUrl}/settings/billing`,
    contractCount: organization.contract_limit,
  });
}

async function handleSubscriptionCreatedOrUpdated(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const organization = await getOrganizationByCustomerId(customerId);

  if (!organization) {
    return;
  }

  await updateOrganizationForSubscription(organization.id, subscription);

  if (subscription.status === "past_due") {
    await sendPastDueWarning(organization);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const organization = await getOrganizationByCustomerId(customerId);

  if (!organization) {
    return;
  }

  await downgradeOrganizationToFree(organization.id);
  await sendCancellationEmail(organization);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = (await headers()).get("stripe-signature");
  const payload = await request.text();

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook event.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (customerId) {
          await sendPaymentFailedEmail(customerId);
        }
        break;
      }
      case "customer.subscription.trial_will_end":
        await sendTrialWillEndEmail(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[stripe-webhook] Processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
