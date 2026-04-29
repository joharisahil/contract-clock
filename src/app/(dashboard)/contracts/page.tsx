import { redirect } from "next/navigation";

import { AddContractModal } from "@/components/contracts/AddContractModal";
import { ContractsTable } from "@/components/contracts/ContractsTable";
import { getContracts, getOrganization, getProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

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
        | {
            id?: string;
            email?: string;
            full_name?: string | null;
          }
        | Array<{
            id?: string;
            email?: string;
            full_name?: string | null;
          }>;
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

export default async function ContractsPage() {
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

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contracts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {contracts.length} {contracts.length === 1 ? "contract" : "contracts"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <AddContractModal
            organizationId={organization.id}
            currentUser={currentUser}
            teamMembers={teamMembers}
            triggerLabel="Add Contract"
          />
          <AddContractModal
            organizationId={organization.id}
            currentUser={currentUser}
            teamMembers={teamMembers}
            triggerLabel="Upload PDF"
          />
        </div>
      </section>

      <ContractsTable
        contracts={contracts}
        organizationId={organization.id}
        currentUser={currentUser}
        teamMembers={teamMembers}
        organizationPlan={organization.plan}
      />
    </div>
  );
}
