import { redirect } from "next/navigation";

import { ContractDetailClient } from "@/components/contracts/ContractDetailClient";
import { createClient } from "@/lib/supabase/server";
import { getContractById, getProfile } from "@/lib/supabase/queries";
import type { ActivityLog, ReminderSchedule } from "@/types";

type ContractDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeActivityLog(log: unknown): ActivityLog {
  const raw = log as ActivityLog & {
    profile?: ActivityLog["profile"] | ActivityLog["profile"][];
  };

  return {
    ...raw,
    profile: Array.isArray(raw.profile) ? raw.profile[0] : raw.profile,
  };
}

export default async function ContractDetailPage({
  params,
}: ContractDetailPageProps) {
  const { id } = await params;

  if (!id) {
    redirect("/contracts");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let contract;

  try {
    contract = await getContractById(supabase, id);
  } catch {
    redirect("/contracts");
  }

  const [activityLogResult, reminderResult, profileResult] = await Promise.all([
    supabase
      .from("activity_logs")
      .select(
        "id, organization_id, profile_id, contract_id, action, metadata, created_at, profile:profiles(*)",
      )
      .eq("contract_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reminder_schedules")
      .select("*")
      .eq("contract_id", id)
      .order("days_before", { ascending: false }),
    getProfile(supabase, user.id).catch(() => null),
  ]);

  return (
    <ContractDetailClient
      contract={contract}
      activityLogs={(activityLogResult.data ?? []).map(normalizeActivityLog)}
      reminderSchedules={(reminderResult.data ?? []) as ReminderSchedule[]}
      currentProfileName={
        profileResult?.full_name ?? profileResult?.email ?? "ContractClock user"
      }
    />
  );
}
