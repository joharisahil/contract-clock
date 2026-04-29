"use client";

import { useRouter } from "next/navigation";

import type { Contract } from "@/types";
import { cn } from "@/lib/utils";

type DashboardContractsTableProps = {
  contracts: Contract[];
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

function formatContractType(type: Contract["contract_type"]) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getRowClass(daysUntilRenewal?: number) {
  if (daysUntilRenewal === undefined) {
    return "";
  }

  if (daysUntilRenewal < 14) {
    return "bg-red-50/80 hover:bg-red-50";
  }

  if (daysUntilRenewal < 30) {
    return "bg-amber-50/80 hover:bg-amber-50";
  }

  if (daysUntilRenewal < 60) {
    return "bg-yellow-50/80 hover:bg-yellow-50";
  }

  return "hover:bg-muted/50";
}

export function DashboardContractsTable({
  contracts,
}: DashboardContractsTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Annual cost</th>
              <th className="px-4 py-3 font-medium">Renewal date</th>
              <th className="px-4 py-3 font-medium">Days left</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr
                key={contract.id}
                className={cn(
                  "cursor-pointer border-t transition-colors",
                  getRowClass(contract.days_until_renewal),
                )}
                onClick={() => router.push(`/contracts/${contract.id}`)}
              >
                <td className="px-4 py-4 font-medium">
                  {contract.vendor_name}
                </td>
                <td className="text-muted-foreground px-4 py-4">
                  {formatContractType(contract.contract_type)}
                </td>
                <td className="px-4 py-4">
                  {formatCurrency(contract.annual_cost, contract.currency)}
                </td>
                <td className="px-4 py-4">{contract.renewal_date}</td>
                <td className="px-4 py-4">
                  {typeof contract.days_until_renewal === "number"
                    ? `${contract.days_until_renewal} days`
                    : "-"}
                </td>
                <td className="px-4 py-4 capitalize">
                  {contract.status.replaceAll("_", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
