import { subMonths } from "date-fns";
import { redirect } from "next/navigation";

import { AnalyticsClient } from "@/components/dashboard/analytics-client";
import { createClient } from "@/lib/supabase/server";
import { getContracts, getOrganization, getProfile } from "@/lib/supabase/queries";
import type { Contract, ContractType } from "@/types";

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
};

function normalizeTeamMembers(currentUser: TeamMember, joinedMembers: unknown[]): TeamMember[] {
  const seen = new Set<string>([currentUser.id]);
  const others: TeamMember[] = [];

  joinedMembers.forEach((member) => {
    const record = member as {
      profile_id?: string;
      profiles?:
        | { id?: string; email?: string; full_name?: string | null }
        | Array<{ id?: string; email?: string; full_name?: string | null }>;
    };

    const profile = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles;
    const id = profile?.id ?? record.profile_id;
    const email = profile?.email;

    if (!id || !email || seen.has(id)) {
      return;
    }

    seen.add(id);
    others.push({
      id,
      email,
      full_name: profile?.full_name ?? null,
    });
  });

  return [currentUser, ...others];
}

function getAnalyticsCategory(contractType: ContractType) {
  if (contractType === "software_subscription") return "software";
  if (contractType === "vendor_service" || contractType === "freelancer_retainer") return "services";
  if (contractType === "office_lease" || contractType === "equipment_lease") return "leases";
  if (contractType === "insurance") return "insurance";
  return "other";
}

function annualCost(contract: Contract) {
  return contract.annual_cost ?? 0;
}

export default async function AnalyticsPage() {
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
  const { data: organizationMembers } = await supabase
    .from("organization_members")
    .select("profile_id, profiles(id, email, full_name)")
    .eq("organization_id", organization.id);

  const currentUser: TeamMember = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
  };

  const teamMembers = normalizeTeamMembers(currentUser, organizationMembers ?? []);
  const contracts = await getContracts(supabase, organization.id);
  const activeContracts = contracts.filter((contract) =>
    ["active", "expiring_soon", "action_required"].includes(contract.status),
  );
  const totalAnnualSpend = activeContracts.reduce(
    (sum, contract) => sum + annualCost(contract),
    0,
  );

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const monthlySpend = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthContracts = activeContracts.filter((contract) => {
      const month = new Date(contract.renewal_date).getMonth();
      return month === monthIndex;
    });

    return {
      month: monthFormatter.format(new Date(2026, monthIndex, 1)),
      total: monthContracts.reduce((sum, contract) => sum + annualCost(contract), 0),
      contracts: monthContracts.map((contract) => ({
        id: contract.id,
        vendor_name: contract.vendor_name,
        amount: annualCost(contract),
        currency: contract.currency,
      })),
    };
  });

  const categoryMap = {
    software: {
      label: "Software",
      contractTypes: ["software_subscription"] as ContractType[],
      color: "#111827",
    },
    services: {
      label: "Services",
      contractTypes: ["vendor_service", "freelancer_retainer"] as ContractType[],
      color: "#d97706",
    },
    leases: {
      label: "Leases",
      contractTypes: ["office_lease", "equipment_lease"] as ContractType[],
      color: "#0f766e",
    },
    insurance: {
      label: "Insurance",
      contractTypes: ["insurance"] as ContractType[],
      color: "#2563eb",
    },
    other: {
      label: "Other",
      contractTypes: ["professional_membership", "other"] as ContractType[],
      color: "#7c3aed",
    },
  };

  const categorySpend = Object.entries(categoryMap).map(([key, config]) => ({
    key,
    label: config.label,
    contractTypes: config.contractTypes,
    color: config.color,
    value: activeContracts
      .filter((contract) => getAnalyticsCategory(contract.contract_type) === key)
      .reduce((sum, contract) => sum + annualCost(contract), 0),
  }));

  const largestContracts = [...activeContracts]
    .sort((a, b) => annualCost(b) - annualCost(a))
    .slice(0, 5)
    .map((contract, index) => ({
      id: contract.id,
      rank: index + 1,
      vendor_name: contract.vendor_name,
      annual_cost: contract.annual_cost,
      renewal_date: contract.renewal_date,
      share_of_total:
        totalAnnualSpend > 0
          ? Math.round((annualCost(contract) / totalAnnualSpend) * 100)
          : 0,
    }));

  const sixMonthsAgo = subMonths(new Date(), 6);
  const staleContracts = activeContracts.filter(
    (contract) => new Date(contract.updated_at) < sixMonthsAgo,
  );
  const staleReviewCount = staleContracts.length;
  const staleReviewValue = staleContracts.reduce(
    (sum, contract) => sum + annualCost(contract),
    0,
  );
  const missingPdfCount = activeContracts.filter((contract) => !contract.pdf_url).length;

  return (
    <AnalyticsClient
      contracts={contracts}
      organizationId={organization.id}
      organizationPlan={organization.plan}
      currentUser={currentUser}
      teamMembers={teamMembers}
      totalAnnualSpend={totalAnnualSpend}
      activeContractCount={activeContracts.length}
      monthlySpend={monthlySpend}
      categorySpend={categorySpend}
      largestContracts={largestContracts}
      staleReviewCount={staleReviewCount}
      staleReviewValue={staleReviewValue}
      missingPdfCount={missingPdfCount}
      currency={profile.currency}
    />
  );
}
