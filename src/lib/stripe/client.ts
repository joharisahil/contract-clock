import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe() {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(apiKey, {
      apiVersion: "2026-04-22.dahlia",
    });
  }

  return stripeInstance;
}

export const PLAN_PRICES = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
  starter_yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? "",
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? "",
  business_yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? "",
  agency_monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY ?? "",
  agency_yearly: process.env.STRIPE_PRICE_AGENCY_YEARLY ?? "",
} as const;
