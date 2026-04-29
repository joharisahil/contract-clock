import { redirect } from "next/navigation";

import { CalendarClient } from "@/components/dashboard/calendar-client";
import { createClient } from "@/lib/supabase/server";
import { getContracts, getOrganization, getProfile } from "@/lib/supabase/queries";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let organization;

  try {
    organization = await getOrganization(supabase, user.id);
  } catch {
    redirect("/dashboard");
  }

  const profile = await getProfile(supabase, user.id);
  const contracts = await getContracts(supabase, organization.id);

  return <CalendarClient contracts={contracts} currency={profile.currency} />;
}
