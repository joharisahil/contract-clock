import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Contract, DashboardStats, Organization, Profile } from "@/types";

type ContractInsert = Omit<
  Contract,
  "id" | "created_at" | "updated_at" | "days_until_renewal" | "monthly_cost"
>;
type ContractUpdate = Partial<ContractInsert>;

type DashboardStatsRow = {
  total_contracts: number | null;
  expiring_30_days: number | null;
  expiring_30_days_value: number | null;
  total_annual_spend: number | null;
  action_required: number | null;
};

function computeDaysUntilRenewal(renewalDate: string) {
  return differenceInCalendarDays(
    parseISO(renewalDate),
    startOfDay(new Date()),
  );
}

function mapContract(contract: Contract): Contract {
  return {
    ...contract,
    days_until_renewal: computeDaysUntilRenewal(contract.renewal_date),
  };
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load profile.");
  }

  return data as Profile;
}

export async function getOrganization(
  supabase: SupabaseClient,
  userId: string,
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No organization found.");
  }

  return data as Organization;
}

export async function getContracts(
  supabase: SupabaseClient,
  organizationId: string,
  filters?: Partial<Pick<Contract, "status" | "contract_type" | "owner_id">>,
): Promise<Contract[]> {
  let query = supabase
    .from("contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("renewal_date", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.contract_type) {
    query = query.eq("contract_type", filters.contract_type);
  }

  if (filters?.owner_id) {
    query = query.eq("owner_id", filters.owner_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((contract) => mapContract(contract as Contract));
}

export async function getContractById(
  supabase: SupabaseClient,
  contractId: string,
): Promise<Contract> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load contract.");
  }

  return mapContract(data as Contract);
}

export async function getDashboardStats(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<DashboardStats> {
  const { data, error } = await supabase
    .rpc("get_dashboard_stats", {
      organization_id_input: organizationId,
    })
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load dashboard stats.");
  }

  const stats = data as DashboardStatsRow;

  return {
    total_contracts: stats.total_contracts ?? 0,
    expiring_30_days: stats.expiring_30_days ?? 0,
    expiring_30_days_value: stats.expiring_30_days_value ?? 0,
    total_annual_spend: stats.total_annual_spend ?? 0,
    action_required: stats.action_required ?? 0,
  };
}

export async function createContract(
  supabase: SupabaseClient,
  data: ContractInsert,
): Promise<Contract> {
  const { data: created, error } = await supabase
    .from("contracts")
    .insert(data)
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Unable to create contract.");
  }

  return mapContract(created as Contract);
}

export async function updateContract(
  supabase: SupabaseClient,
  id: string,
  data: ContractUpdate,
): Promise<Contract> {
  const { data: updated, error } = await supabase
    .from("contracts")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(error?.message ?? "Unable to update contract.");
  }

  return mapContract(updated as Contract);
}

export async function deleteContract(
  supabase: SupabaseClient,
  id: string,
): Promise<Contract> {
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to cancel contract.");
  }

  return mapContract(data as Contract);
}
