"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { ContractsTable } from "@/components/contracts/ContractsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Contract, ContractType, PlanType } from "@/types";

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
};

type MonthlySpendDatum = {
  month: string;
  total: number;
  contracts: Array<{ id: string; vendor_name: string; amount: number; currency: string }>;
};

type CategorySpendDatum = {
  key: string;
  label: string;
  value: number;
  contractTypes: ContractType[];
  color: string;
};

type LargestContractDatum = {
  id: string;
  rank: number;
  vendor_name: string;
  annual_cost: number | null;
  renewal_date: string;
  share_of_total: number;
};

type AnalyticsClientProps = {
  contracts: Contract[];
  organizationId: string;
  organizationPlan: PlanType;
  currentUser: TeamMember;
  teamMembers: TeamMember[];
  totalAnnualSpend: number;
  activeContractCount: number;
  monthlySpend: MonthlySpendDatum[];
  categorySpend: CategorySpendDatum[];
  largestContracts: LargestContractDatum[];
  staleReviewCount: number;
  staleReviewValue: number;
  missingPdfCount: number;
  currency: string;
};

function formatCurrency(value: number | null, currency = "USD") {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function ContractsTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlySpendDatum }>;
  currency: string;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-background w-72 rounded-xl border p-3 text-sm shadow-lg">
      <p className="font-semibold">{data.month}</p>
      <p className="text-muted-foreground mt-1">
        Total due: {formatCurrency(data.total, currency)}
      </p>
      <div className="mt-3 space-y-1">
        {data.contracts.length > 0 ? (
          data.contracts.map((contract) => (
            <div key={contract.id} className="flex justify-between gap-3">
              <span className="truncate">{contract.vendor_name}</span>
              <span>{formatCurrency(contract.amount, contract.currency)}</span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No payments due</p>
        )}
      </div>
    </div>
  );
}

export function AnalyticsClient({
  contracts,
  organizationId,
  organizationPlan,
  currentUser,
  teamMembers,
  totalAnnualSpend,
  activeContractCount,
  monthlySpend,
  categorySpend,
  largestContracts,
  staleReviewCount,
  staleReviewValue,
  missingPdfCount,
  currency,
}: AnalyticsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredContracts = useMemo(() => {
    if (!selectedCategory) {
      return contracts;
    }

    const category = categorySpend.find((item) => item.key === selectedCategory);

    if (!category) {
      return contracts;
    }

    return contracts.filter((contract) =>
      category.contractTypes.includes(contract.contract_type),
    );
  }, [categorySpend, contracts, selectedCategory]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-3 p-8">
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-[0.2em]">
            Total Annual Committed Spend
          </p>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {formatCurrency(totalAnnualSpend, currency)} / year
          </h2>
          <p className="text-muted-foreground text-sm">
            Across {activeContractCount} active contracts
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly payment calendar</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySpend}>
                <Tooltip content={<ContractsTooltip currency={currency} />} />
                <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                  {monthlySpend.map((item, index) => (
                    <Cell
                      key={`${item.month}-${index}`}
                      fill={item.total === Math.max(...monthlySpend.map((m) => m.total)) ? "#111827" : "#d4a373"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-6">
              {monthlySpend.map((month) => (
                <div key={month.month} className="rounded-xl border px-3 py-2">
                  <p className="font-medium">{month.month}</p>
                  <p className="text-muted-foreground">
                    {formatCurrency(month.total, currency)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(
                        typeof value === "number" ? value : Number(value ?? 0),
                        currency,
                      )
                    }
                  />
                  <Pie
                    data={categorySpend}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={72}
                    outerRadius={108}
                    paddingAngle={4}
                    onClick={(data) =>
                      setSelectedCategory((current) =>
                        current === String(data.key) ? null : String(data.key),
                      )
                    }
                  >
                    {categorySpend.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={entry.color}
                        stroke={selectedCategory === entry.key ? "#111827" : entry.color}
                        strokeWidth={selectedCategory === entry.key ? 3 : 1}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {categorySpend.map((item) => {
                const percentage =
                  totalAnnualSpend > 0
                    ? Math.round((item.value / totalAnnualSpend) * 100)
                    : 0;

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm",
                      selectedCategory === item.key ? "border-foreground" : "",
                    )}
                    onClick={() =>
                      setSelectedCategory((current) =>
                        current === item.key ? null : item.key,
                      )
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label} {percentage}%
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(item.value, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Largest contracts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {largestContracts.map((contract) => (
              <div
                key={contract.id}
                className="grid grid-cols-[40px_minmax(0,1fr)_140px_140px_100px] items-center gap-3 rounded-xl border px-4 py-3 text-sm"
              >
                <span className="text-muted-foreground font-medium">
                  #{contract.rank}
                </span>
                <span className="truncate font-medium">{contract.vendor_name}</span>
                <span>{formatCurrency(contract.annual_cost, currency)}</span>
                <span className="text-muted-foreground">{contract.renewal_date}</span>
                <span className="text-right">{contract.share_of_total}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Potential savings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="font-medium text-amber-900">
                {staleReviewCount} contracts worth{" "}
                {formatCurrency(staleReviewValue, currency)} haven&apos;t been
                reviewed recently
              </p>
              <p className="mt-1 text-sm text-amber-800">
                These records haven&apos;t changed in 6+ months, which can be a
                good place to hunt for renegotiation opportunities.
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <p className="font-medium text-stone-900">
                {missingPdfCount} contracts have no document on file
              </p>
              <p className="mt-1 text-sm text-stone-700">
                Uploading the source agreement makes renewal reviews and AI
                extraction far more reliable.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">Contracts list</h3>
            <p className="text-muted-foreground text-sm">
              {selectedCategory
                ? "Filtered by your chart selection."
                : "All contracts, ready for deeper review."}
            </p>
          </div>
        </div>

        <ContractsTable
          contracts={filteredContracts}
          organizationId={organizationId}
          organizationPlan={organizationPlan}
          currentUser={currentUser}
          teamMembers={teamMembers}
        />
      </div>
    </div>
  );
}
