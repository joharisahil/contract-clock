import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { DashboardLayoutShell } from "@/components/layout/dashboard-layout-shell";
import { getOrganization, getProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile } from "@/types";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

function fallbackProfile(user: User): Profile {
  return {
    id: user.id,
    email: user.email ?? "",
    full_name:
      (user.user_metadata.full_name as string | undefined) ??
      (user.user_metadata.name as string | undefined) ??
      null,
    role: "admin",
    timezone: "UTC",
    currency: "USD",
    persona: null,
    created_at: user.created_at,
  };
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileResult, organizationResult] = await Promise.allSettled([
    getProfile(supabase, user.id),
    getOrganization(supabase, user.id),
  ]);

  const profile =
    profileResult.status === "fulfilled"
      ? profileResult.value
      : fallbackProfile(user);
  const organization: Organization | null =
    organizationResult.status === "fulfilled" ? organizationResult.value : null;

  return (
    <DashboardLayoutShell profile={profile} organization={organization}>
      {children}
    </DashboardLayoutShell>
  );
}
