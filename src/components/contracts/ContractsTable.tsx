"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Trash2, UploadCloud } from "lucide-react";

import { AddContractModal } from "@/components/contracts/AddContractModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Contract, ContractStatus, ContractType, PlanType } from "@/types";

const PAGE_SIZE = 15;

type ContractsTableProps = {
  contracts: Contract[];
  organizationId: string;
  currentUser: { id: string; email: string; full_name: string | null };
  teamMembers: { id: string; email: string; full_name: string | null }[];
  organizationPlan: PlanType;
};

function formatCurrency(value: number | null, currency = "USD") {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatContractType(type: string) {
  return type
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function formatStatus(status: ContractStatus) {
  return status
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function getStatusBadgeClass(status: ContractStatus) {
  const map: Record<ContractStatus, string> = {
    active: "bg-green-100 text-green-700",
    expiring_soon: "bg-amber-100 text-amber-700",
    action_required: "bg-red-100 text-red-700",
    expired: "bg-gray-100 text-gray-600",
    cancelled: "bg-gray-100 text-gray-400",
    renewed: "bg-blue-100 text-blue-700",
  };
  return map[status];
}

function getDaysColor(days: number | undefined | null) {
  if (days == null) return "text-muted-foreground";
  if (days < 0) return "text-muted-foreground line-through";
  if (days < 14) return "text-red-600 font-semibold";
  if (days < 30) return "text-amber-600 font-semibold";
  if (days < 60) return "text-yellow-600";
  return "text-muted-foreground";
}

function getRowClass(days: number | undefined | null) {
  if (days == null || days < 0 || days >= 60) {
    return "hover:bg-muted/40";
  }

  if (days < 14) {
    return "bg-red-50/70 hover:bg-red-50";
  }

  if (days < 30) {
    return "bg-amber-50/70 hover:bg-amber-50";
  }

  return "bg-yellow-50/70 hover:bg-yellow-50";
}

function csvValue(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const contractTypes: ContractType[] = [
  "software_subscription",
  "vendor_service",
  "office_lease",
  "equipment_lease",
  "insurance",
  "freelancer_retainer",
  "professional_membership",
  "other",
];

export function ContractsTable({
  contracts,
  organizationId,
  currentUser,
  teamMembers,
  organizationPlan,
}: ContractsTableProps) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilters, setTypeFilters] = useState<Set<ContractType>>(new Set());
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [renewalFrom, setRenewalFrom] = useState("");
  const [renewalTo, setRenewalTo] = useState("");
  const [sortBy, setSortBy] = useState("renewal_asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);

  const isProPlus =
    organizationPlan === "pro" ||
    organizationPlan === "business" ||
    organizationPlan === "agency";

  const ownerMap = useMemo(
    () =>
      new Map(
        teamMembers.map((member) => [
          member.id,
          member.full_name ?? member.email,
        ]),
      ),
    [teamMembers],
  );

  const filteredContracts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = contracts
      .filter((contract) =>
        contract.vendor_name.toLowerCase().includes(normalizedSearch),
      )
      .filter((contract) =>
        statusFilter === "all"
          ? true
          : statusFilter === "expiring"
            ? contract.status === "expiring_soon" ||
              contract.status === "action_required"
            : contract.status === statusFilter,
      )
      .filter((contract) =>
        typeFilters.size === 0 ? true : typeFilters.has(contract.contract_type),
      )
      .filter((contract) =>
        !isProPlus || ownerFilter === "all"
          ? true
          : contract.owner_id === ownerFilter,
      )
      .filter((contract) =>
        renewalFrom ? contract.renewal_date >= renewalFrom : true,
      )
      .filter((contract) => (renewalTo ? contract.renewal_date <= renewalTo : true));

    next.sort((a, b) => {
      switch (sortBy) {
        case "renewal_desc":
          return b.renewal_date.localeCompare(a.renewal_date);
        case "cost_high":
          return (b.annual_cost ?? -1) - (a.annual_cost ?? -1);
        case "cost_low":
          return (a.annual_cost ?? Number.MAX_SAFE_INTEGER) - (b.annual_cost ?? Number.MAX_SAFE_INTEGER);
        case "name_az":
          return a.vendor_name.localeCompare(b.vendor_name);
        case "renewal_asc":
        default:
          return a.renewal_date.localeCompare(b.renewal_date);
      }
    });

    return next;
  }, [
    contracts,
    isProPlus,
    ownerFilter,
    renewalFrom,
    renewalTo,
    search,
    sortBy,
    statusFilter,
    typeFilters,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    typeFilters.size > 0 ||
    ownerFilter !== "all" ||
    renewalFrom !== "" ||
    renewalTo !== "" ||
    sortBy !== "renewal_asc";

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageContracts = filteredContracts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const selectedContracts = filteredContracts.filter((contract) =>
    selectedIds.has(contract.id),
  );

  const allPageSelected =
    pageContracts.length > 0 &&
    pageContracts.every((contract) => selectedIds.has(contract.id));

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilters(new Set());
    setOwnerFilter("all");
    setRenewalFrom("");
    setRenewalTo("");
    setSortBy("renewal_asc");
    setPage(1);
  };

  const exportContracts = (rows: Contract[]) => {
    downloadCsv("contractclock-contracts.csv", [
      [
        "Vendor",
        "Type",
        "Annual Cost",
        "Currency",
        "Renewal Date",
        "Days Until Renewal",
        "Status",
        "Owner",
        "Notes",
      ],
      ...rows.map((contract) => [
        csvValue(contract.vendor_name),
        csvValue(formatContractType(contract.contract_type)),
        csvValue(contract.annual_cost),
        csvValue(contract.currency),
        csvValue(contract.renewal_date),
        csvValue(contract.days_until_renewal),
        csvValue(formatStatus(contract.status)),
        csvValue(ownerMap.get(contract.owner_id) ?? "Unknown"),
        csvValue(contract.notes),
      ]),
    ]);
  };

  const toggleTypeFilter = (type: ContractType) => {
    setTypeFilters((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    setPage(1);
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        pageContracts.forEach((contract) => next.delete(contract.id));
      } else {
        pageContracts.forEach((contract) => next.add(contract.id));
      }
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0 || isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("contracts")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) {
        throw error;
      }

      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  if (contracts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">No contracts yet</h2>
            <p className="text-muted-foreground max-w-md text-sm">
              Add your first contract to start tracking renewals, spend, and
              notice windows.
            </p>
          </div>
          <AddContractModal
            organizationId={organizationId}
            currentUser={currentUser}
            teamMembers={teamMembers}
            triggerLabel="Add Contract"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_220px_170px_190px_190px_180px_auto]">
        <Input
          placeholder="Search by vendor name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <details className="border-input bg-background rounded-md border px-3 py-2 text-sm">
          <summary className="cursor-pointer list-none">
            {typeFilters.size > 0 ? `${typeFilters.size} types selected` : "All types"}
          </summary>
          <div className="mt-3 grid gap-2">
            {contractTypes.map((type) => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={typeFilters.has(type)}
                  onChange={() => toggleTypeFilter(type)}
                />
                <span>{formatContractType(type)}</span>
              </label>
            ))}
          </div>
        </details>
        <select
          className="border-input bg-background h-10 rounded-md border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {isProPlus ? (
          <select
            className="border-input bg-background h-10 rounded-md border px-3 py-2 text-sm"
            value={ownerFilter}
            onChange={(event) => {
              setOwnerFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All owners</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name ?? member.email}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">
            Owner filter available on Pro+
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={renewalFrom}
            onChange={(event) => {
              setRenewalFrom(event.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            value={renewalTo}
            onChange={(event) => {
              setRenewalTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="border-input bg-background h-10 rounded-md border px-3 py-2 text-sm"
          value={sortBy}
          onChange={(event) => {
            setSortBy(event.target.value);
            setPage(1);
          }}
        >
          <option value="renewal_asc">Renewal date asc</option>
          <option value="renewal_desc">Renewal date desc</option>
          <option value="cost_high">Cost high-low</option>
          <option value="cost_low">Cost low-high</option>
          <option value="name_az">Name A-Z</option>
        </select>
        <div className="flex gap-2">
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => exportContracts(filteredContracts)}
          >
            <FileDown className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">{selectedIds.size} selected</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportContracts(selectedContracts)}
            >
              <FileDown className="size-4" />
              Export selected
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={deleteSelected}
            >
              <Trash2 className="size-4" />
              {isDeleting ? "Deleting..." : "Delete selected"}
            </Button>
          </div>
        </div>
      ) : null}

      {filteredContracts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">
                No contracts match your filters
              </h2>
              <p className="text-muted-foreground text-sm">
                Try broadening your filters or clearing the current search.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Annual cost</th>
                    <th className="px-4 py-3 font-medium">Renewal date</th>
                    <th className="px-4 py-3 font-medium">Days left</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageContracts.map((contract) => (
                    <tr
                      key={contract.id}
                      className={cn(
                        "group cursor-pointer border-t transition-colors",
                        getRowClass(contract.days_until_renewal),
                      )}
                      onClick={() => router.push(`/contracts/${contract.id}`)}
                    >
                      <td
                        className="px-4 py-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contract.id)}
                          onChange={() => toggleSelected(contract.id)}
                        />
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {contract.vendor_name}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {formatContractType(contract.contract_type)}
                      </td>
                      <td className="px-4 py-4">
                        {formatCurrency(contract.annual_cost, contract.currency)}
                      </td>
                      <td className="px-4 py-4">{contract.renewal_date}</td>
                      <td
                        className={cn(
                          "px-4 py-4",
                          getDaysColor(contract.days_until_renewal),
                        )}
                      >
                        {contract.days_until_renewal == null
                          ? "-"
                          : `${contract.days_until_renewal} days`}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {ownerMap.get(contract.owner_id) ?? "Unknown"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                            getStatusBadgeClass(contract.status),
                          )}
                        >
                          {formatStatus(contract.status)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/contracts/${contract.id}`)}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!contract.pdf_url}
                            onClick={() => {
                              if (contract.pdf_url) {
                                window.open(contract.pdf_url, "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            <UploadCloud className="size-4" />
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, filteredContracts.length)} of{" "}
              {filteredContracts.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={cn(
                      "h-9 min-w-9 rounded-md px-3 text-sm transition-colors",
                      pageNumber === currentPage
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
