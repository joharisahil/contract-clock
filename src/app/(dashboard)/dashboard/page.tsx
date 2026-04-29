import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  FilePlus2,
  FileText,
  UploadCloud,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { DashboardContractsTable } from "@/components/dashboard/dashboard-contracts-table";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { AddContractModal } from "@/components/contracts/AddContractModal";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getContracts,
  getDashboardStats,
  getOrganization,
  getProfile,
} from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type {
  ContractType,
  DashboardStats,
  Organization,
  Profile,
} from "@/types";

const CONTRACTS_PER_PAGE = 10;

type DashboardPageProps = {
  searchParams: Promise<{
    welcome?: string;
    page?: string;
  }>;
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

function formatContractType(type: ContractType) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatCurrencyValue(value: number | null, currency = "USD") {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getUrgencyBadgeClasses(daysUntilRenewal: number) {
  if (daysUntilRenewal < 14) {
    return "bg-red-100 text-red-700";
  }

  if (daysUntilRenewal < 30) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function buildStatsCards(stats: DashboardStats, currency: string) {
  return [
    {
      label: "Total contracts",
      value: stats.total_contracts.toString(),
      description: "Across all tracked agreements",
    },
    {
      label: "Renewing in 30 days",
      value: stats.expiring_30_days.toString(),
      description: formatCurrencyValue(stats.expiring_30_days_value, currency),
    },
    {
      label: "Annual committed spend",
      value: formatCurrencyValue(stats.total_annual_spend, currency),
      description: "Current annual exposure",
    },
    {
      label: "Requires action",
      value: stats.action_required.toString(),
      description: "Within notice period",
      danger: stats.action_required > 0,
    },
  ];
}

function buildPagination(page: number, totalContracts: number) {
  const totalPages = Math.max(
    1,
    Math.ceil(totalContracts / CONTRACTS_PER_PAGE),
  );

  return {
    page,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { welcome, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profilePromise = getProfile(supabase, user.id).catch(() =>
    fallbackProfile(user),
  );
  const organizationPromise = getOrganization(supabase, user.id).catch(
    () => null as Organization | null,
  );

  const [profile, organization] = await Promise.all([
    profilePromise,
    organizationPromise,
  ]);

  if (!organization) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] items-center justify-center">
        <Card className="w-full max-w-2xl text-center">
          <CardContent className="space-y-6 p-10">
            <div className="bg-muted mx-auto flex size-20 items-center justify-center rounded-full">
              <FileText className="text-muted-foreground size-9" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Create your workspace</h2>
              <p className="text-muted-foreground text-sm">
                We couldn&apos;t find an organization for this account yet.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [contracts, stats] = await Promise.all([
    getContracts(supabase, organization.id),
    getDashboardStats(supabase, organization.id).catch(() => ({
      total_contracts: 0,
      expiring_30_days: 0,
      expiring_30_days_value: 0,
      total_annual_spend: 0,
      action_required: 0,
    })),
  ]);
  const currentUser = {
    id: user.id,
    email: user.email ?? profile.email,
    full_name:
      profile.full_name ??
      (typeof user.user_metadata.full_name === "string"
        ? user.user_metadata.full_name
        : null) ??
      (typeof user.user_metadata.name === "string"
        ? user.user_metadata.name
        : null),
  };

  const urgentContracts = contracts
    .filter(
      (contract) =>
        typeof contract.days_until_renewal === "number" &&
        contract.days_until_renewal >= 0 &&
        contract.days_until_renewal <= 60,
    )
    .sort(
      (a, b) => (a.days_until_renewal ?? 9999) - (b.days_until_renewal ?? 9999),
    );

  const pagination = buildPagination(page, contracts.length);
  const paginatedContracts = contracts.slice(
    (pagination.page - 1) * CONTRACTS_PER_PAGE,
    pagination.page * CONTRACTS_PER_PAGE,
  );
  const statsCards = buildStatsCards(stats, profile.currency);

  if (contracts.length === 0) {
    return (
      <div className="space-y-6">
        {welcome === "true" ? <WelcomeBanner /> : null}
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center">
            <div className="relative">
              <div className="bg-primary/10 absolute inset-0 rounded-full blur-2xl" />
              <div className="bg-background relative flex size-24 items-center justify-center rounded-full border shadow-sm">
                <FilePlus2 className="text-primary size-10" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">
                Add your first contract
              </h2>
              <p className="text-muted-foreground max-w-md text-sm">
                Start by entering a contract manually or uploading a PDF so
                ContractClock can begin tracking renewal dates and spend.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <AddContractModal
                organizationId={organization.id}
                currentUser={currentUser}
                teamMembers={[currentUser]}
                trigger={
                  <Button type="button" className="w-full sm:w-auto">
                    <FileText className="size-4" />
                    Add manually
                  </Button>
                }
              />
              <AddContractModal
                organizationId={organization.id}
                currentUser={currentUser}
                teamMembers={[currentUser]}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <UploadCloud className="size-4" />
                    Upload a PDF
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {welcome === "true" ? <WelcomeBanner /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="space-y-1">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle
                className={cn(
                  "text-3xl tracking-tight",
                  card.danger ? "text-destructive" : "",
                )}
              >
                {card.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {card.description}
            </CardContent>
          </Card>
        ))}
      </section>

      {urgentContracts.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" />
            <h2 className="text-xl font-semibold">Needs your attention</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {urgentContracts.map((contract) => (
              <Card key={contract.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">
                        {contract.vendor_name}
                      </h3>
                      <span className="bg-muted inline-flex rounded-full px-3 py-1 text-xs font-medium">
                        {formatContractType(contract.contract_type)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium",
                        getUrgencyBadgeClasses(
                          contract.days_until_renewal ?? 60,
                        ),
                      )}
                    >
                      {contract.days_until_renewal} days left
                    </span>
                  </div>
                  <div className="text-muted-foreground flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      Renewal date:{" "}
                      <span className="text-foreground">
                        {contract.renewal_date}
                      </span>
                    </p>
                    <p>
                      Annual cost:{" "}
                      <span className="text-foreground">
                        {formatCurrencyValue(
                          contract.annual_cost,
                          contract.currency,
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm">
                      Renew
                    </Button>
                    <Button type="button" size="sm" variant="outline">
                      Cancel
                    </Button>
                    <Button type="button" size="sm" variant="secondary">
                      Snooze 7 days
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">All contracts</h2>
            <p className="text-muted-foreground text-sm">
              Sorted by upcoming renewals, with urgency highlighted directly in
              the table.
            </p>
          </div>
          <Link
            href="/contracts"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            View all
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <DashboardContractsTable contracts={paginatedContracts} />

        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {(pagination.page - 1) * CONTRACTS_PER_PAGE + 1}-
            {Math.min(pagination.page * CONTRACTS_PER_PAGE, contracts.length)}{" "}
            of {contracts.length}
          </p>
          <div className="flex gap-2">
            <Link
              href={`/dashboard?page=${Math.max(1, pagination.page - 1)}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                !pagination.hasPrevious ? "pointer-events-none opacity-50" : "",
              )}
            >
              Previous
            </Link>
            <Link
              href={`/dashboard?page=${Math.min(pagination.totalPages, pagination.page + 1)}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                !pagination.hasNext ? "pointer-events-none opacity-50" : "",
              )}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
