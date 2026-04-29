import { redirect } from "next/navigation";

import { SettingsClient } from "@/components/settings/settings-client";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getContracts, getOrganization, getProfile } from "@/lib/supabase/queries";
import type { UserRole } from "@/types";

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  joined_at: string | null;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
};

function normalizeTeamMembers(rows: unknown[]): TeamMember[] {
  return rows.flatMap((row) => {
    const record = row as {
      created_at?: string | null;
      role?: UserRole;
      profiles?:
        | { id?: string; email?: string; full_name?: string | null }
        | Array<{ id?: string; email?: string; full_name?: string | null }>;
    };

    const profile = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles;

    if (!profile?.id || !profile.email) {
      return [];
    }

    return [
      {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name ?? null,
        role: record.role ?? "member",
        joined_at: record.created_at ?? null,
      },
    ];
  });
}

export default async function SettingsPage() {
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

  const [profile, contracts, membersResponse, invitesResponse, settingsResponse] =
    await Promise.all([
      getProfile(supabase, user.id),
      getContracts(supabase, organization.id),
      supabase
        .from("organization_members")
        .select("created_at, role, profiles(id, email, full_name)")
        .eq("organization_id", organization.id),
      supabase
        .from("organization_invitations")
        .select("id, email, role, created_at")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_settings")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle(),
    ]);

  const teamMembers = normalizeTeamMembers(membersResponse.data ?? []);
  const pendingInvitations = ((invitesResponse.data ?? []) as PendingInvitation[]).map(
    (invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      created_at: invite.created_at,
    }),
  );

  const settingsRecord = (settingsResponse.data ?? {}) as {
    slack_webhook?: string | null;
    weekly_digest_enabled?: boolean | null;
    weekly_digest_time?: string | null;
    email_reminders_enabled?: boolean | null;
  };

  const reminderDefaultsResponse = await supabase
    .from("reminder_schedules")
    .select("days_before")
    .eq("organization_id", organization.id)
    .is("contract_id", null)
    .eq("enabled", true)
    .order("days_before", { ascending: false });

  const reminderDefaults = (reminderDefaultsResponse.data ?? []).map(
    (row) => row.days_before as number,
  );

  let invoices: Array<{
    id: string;
    amount_paid: number;
    currency: string;
    status: string;
    created: number;
    hosted_invoice_url: string | null;
  }> = [];

  if (organization.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const invoiceList = await stripe.invoices.list({
        customer: organization.stripe_customer_id,
        limit: 10,
      });

      invoices = invoiceList.data.map((invoice) => ({
        id: invoice.id,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status ?? "unknown",
        created: invoice.created,
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      }));
    } catch {
      invoices = [];
    }
  }

  return (
    <SettingsClient
      profile={profile}
      organization={organization}
      contracts={contracts}
      teamMembers={teamMembers}
      pendingInvitations={pendingInvitations}
      invoices={invoices}
      slackWebhook={settingsRecord.slack_webhook ?? ""}
      reminderDefaults={reminderDefaults.length > 0 ? reminderDefaults : [90, 60, 30, 14, 7]}
      weeklyDigestEnabled={settingsRecord.weekly_digest_enabled ?? false}
      digestTime={settingsRecord.weekly_digest_time ?? "09:00"}
    />
  );
}
