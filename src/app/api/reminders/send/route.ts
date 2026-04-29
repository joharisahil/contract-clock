import { addDays, differenceInCalendarDays, formatISO, parseISO, startOfDay } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { sendReminderEmail } from "@/lib/resend";
import { sendSlackNotification } from "@/lib/slack";
import type { Contract, Organization, Profile, ReminderSchedule } from "@/types";

export const runtime = "nodejs";

const DEFAULT_REMINDER_SCHEDULE = [90, 60, 30, 14, 7];

type OrganizationWithSlack = Organization & {
  slack_webhook?: string | null;
};

type ReminderLogRow = {
  contract_id: string;
  days_before: number;
};

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");

  return header === secret || header === `Bearer ${secret}`;
}

function organizationHasActivePlan(organization: Organization) {
  const today = startOfDay(new Date());

  if (organization.plan === "free") {
    return true;
  }

  if (organization.stripe_subscription_id) {
    return true;
  }

  if (!organization.trial_ends_at) {
    return true;
  }

  return startOfDay(parseISO(organization.trial_ends_at)) >= today;
}

function getScheduleDaysForContract(
  contract: Contract,
  schedules: ReminderSchedule[],
) {
  const contractSpecific = schedules
    .filter((schedule) => schedule.contract_id === contract.id && schedule.enabled)
    .map((schedule) => schedule.days_before);

  if (contractSpecific.length > 0) {
    return Array.from(new Set(contractSpecific)).sort((a, b) => b - a);
  }

  const orgDefault = schedules
    .filter(
      (schedule) =>
        schedule.organization_id === contract.organization_id &&
        schedule.contract_id === null &&
        schedule.enabled,
    )
    .map((schedule) => schedule.days_before);

  if (orgDefault.length > 0) {
    return Array.from(new Set(orgDefault)).sort((a, b) => b - a);
  }

  return DEFAULT_REMINDER_SCHEDULE;
}

async function handleRequest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const today = startOfDay(new Date());
  const yearStart = new Date(today.getFullYear(), 0, 1).toISOString();
  const nextYearStart = new Date(today.getFullYear() + 1, 0, 1).toISOString();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const { data: contractsData, error: contractsError } = await supabase
    .from("contracts")
    .select("*")
    .in("status", ["active", "expiring_soon"])
    .gte("renewal_date", formatISO(today, { representation: "date" }))
    .order("renewal_date", { ascending: true });

  if (contractsError) {
    console.error("[reminders] Failed to load contracts", contractsError);
    return NextResponse.json({ error: contractsError.message }, { status: 500 });
  }

  const contracts = (contractsData ?? []) as Contract[];

  if (contracts.length === 0) {
    return NextResponse.json({ sent, failed, skipped });
  }

  const organizationIds = Array.from(
    new Set(contracts.map((contract) => contract.organization_id)),
  );
  const ownerIds = Array.from(new Set(contracts.map((contract) => contract.owner_id)));

  const [
    { data: organizationsData, error: organizationsError },
    { data: profilesData, error: profilesError },
    { data: schedulesData, error: schedulesError },
    { data: logsData, error: logsError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, owner_id, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, contract_limit, created_at, slack_webhook")
      .in("id", organizationIds),
    supabase.from("profiles").select("id, email, full_name").in("id", ownerIds),
    supabase
      .from("reminder_schedules")
      .select("*")
      .in("organization_id", organizationIds),
    supabase
      .from("reminder_logs")
      .select("contract_id, days_before")
      .gte("created_at", yearStart)
      .lt("created_at", nextYearStart),
  ]);

  if (organizationsError || profilesError || schedulesError || logsError) {
    const error =
      organizationsError || profilesError || schedulesError || logsError;
    console.error("[reminders] Failed to load dependencies", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to prepare reminders" },
      { status: 500 },
    );
  }

  const organizations = new Map(
    ((organizationsData ?? []) as OrganizationWithSlack[]).map((organization) => [
      organization.id,
      organization,
    ]),
  );
  const profiles = new Map(
    ((profilesData ?? []) as Pick<Profile, "id" | "email" | "full_name">[]).map(
      (profile) => [profile.id, profile],
    ),
  );
  const schedules = (schedulesData ?? []) as ReminderSchedule[];
  const reminderLogs = new Set(
    ((logsData ?? []) as ReminderLogRow[]).map(
      (log) => `${log.contract_id}:${log.days_before}`,
    ),
  );

  for (const contract of contracts) {
    const organization = organizations.get(contract.organization_id);

    if (!organization || !organizationHasActivePlan(organization)) {
      skipped += 1;
      continue;
    }

    const daysUntilRenewal = differenceInCalendarDays(
      startOfDay(parseISO(contract.renewal_date)),
      today,
    );

    if (daysUntilRenewal < 0) {
      skipped += 1;
      continue;
    }

    const scheduleDays = getScheduleDaysForContract(contract, schedules);
    const dueDaysBefore = scheduleDays.find((days) => days === daysUntilRenewal);

    if (dueDaysBefore === undefined) {
      skipped += 1;
      continue;
    }

    const reminderKey = `${contract.id}:${dueDaysBefore}`;

    if (reminderLogs.has(reminderKey)) {
      skipped += 1;
      continue;
    }

    const owner = profiles.get(contract.owner_id);

    if (!owner?.email) {
      console.warn("[reminders] Skipping reminder because owner email is missing", {
        contractId: contract.id,
        ownerId: contract.owner_id,
      });
      skipped += 1;
      continue;
    }

    const cancellationDeadline = formatISO(
      addDays(parseISO(contract.renewal_date), -contract.notice_period_days),
      { representation: "date" },
    );
    const contractUrl = `${appUrl}/contracts/${contract.id}`;

    try {
      const emailResult = await sendReminderEmail(owner.email, {
        vendorName: contract.vendor_name,
        renewalDate: contract.renewal_date,
        daysUntilRenewal,
        annualCost: contract.annual_cost,
        currency: contract.currency,
        noticePeriodDays: contract.notice_period_days,
        cancellationDeadline,
        contractUrl,
        orgName: organization.name,
      });

      const slackResult = organization.slack_webhook
        ? await sendSlackNotification(organization.slack_webhook, {
            vendorName: contract.vendor_name,
            annualCost: contract.annual_cost,
            currency: contract.currency,
            daysUntilRenewal,
            contractUrl,
          })
        : { skipped: true };

      const nextStatus =
        daysUntilRenewal <= contract.notice_period_days
          ? "action_required"
          : daysUntilRenewal <= 60
            ? "expiring_soon"
            : contract.status;

      if (nextStatus !== contract.status) {
        const { error: statusError } = await supabase
          .from("contracts")
          .update({ status: nextStatus })
          .eq("id", contract.id);

        if (statusError) {
          console.error("[reminders] Failed to update contract status", statusError);
        }
      }

      const { error: logError } = await supabase.from("reminder_logs").insert({
        organization_id: contract.organization_id,
        contract_id: contract.id,
        days_before: dueDaysBefore,
        channel: organization.slack_webhook ? "slack" : "email",
        metadata: {
          emailSent: !("skipped" in emailResult),
          slackSent: !("skipped" in slackResult),
          ownerEmail: owner.email,
        },
      });

      if (logError) {
        console.error("[reminders] Failed to insert reminder log", logError);
      }

      reminderLogs.add(reminderKey);
      sent += 1;
    } catch (error) {
      console.error("[reminders] Failed to send reminder", {
        contractId: contract.id,
        error,
      });
      failed += 1;
    }
  }

  return NextResponse.json({ sent, failed, skipped });
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
