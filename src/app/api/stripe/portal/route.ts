import { NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe/client";
import { getOrganization } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const stripe = getStripe();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organization = await getOrganization(supabase, user.id).catch(() => null);

  if (!organization?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing customer found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: organization.stripe_customer_id,
    return_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
