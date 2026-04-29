"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import {
  BellRing,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import type {
  ActivityLog,
  Contract,
  ContractStatus,
  ReminderSchedule,
} from "@/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type ContractDetailClientProps = {
  contract: Contract;
  activityLogs: ActivityLog[];
  reminderSchedules: ReminderSchedule[];
  currentProfileName: string;
};

type EditFormState = {
  vendor_name: string;
  contract_type: Contract["contract_type"];
  annual_cost: string;
  renewal_date: string;
  notice_period_days: string;
  auto_renewal: boolean;
  notes: string;
};

type ReminderItem = ReminderSchedule & {
  upcoming_date: string;
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

function getContractTypeLabel(type: Contract["contract_type"]) {
  return type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getTypeBadgeClass(type: Contract["contract_type"]) {
  switch (type) {
    case "software_subscription":
      return "bg-sky-100 text-sky-800";
    case "vendor_service":
      return "bg-indigo-100 text-indigo-800";
    case "office_lease":
    case "equipment_lease":
      return "bg-violet-100 text-violet-800";
    case "insurance":
      return "bg-emerald-100 text-emerald-800";
    case "freelancer_retainer":
      return "bg-amber-100 text-amber-800";
    case "professional_membership":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-muted text-foreground";
  }
}

function getStatusBadgeClass(status: ContractStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800";
    case "expiring_soon":
      return "bg-amber-100 text-amber-800";
    case "action_required":
      return "bg-red-100 text-red-800";
    case "renewed":
      return "bg-sky-100 text-sky-800";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-zinc-100 text-zinc-800";
  }
}

function getUrgencyBannerClass(daysLeft: number) {
  if (daysLeft < 14) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatCurrency(value: number | null, currency: string) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getMonthlyEquivalent(annualCost: number | null) {
  if (annualCost === null) {
    return null;
  }

  return annualCost / 12;
}

function getNoticeDeadline(contract: Contract) {
  return subDays(parseISO(contract.renewal_date), contract.notice_period_days);
}

function buildReminderTimeline(
  contract: Contract,
  schedules: ReminderSchedule[],
): ReminderItem[] {
  const defaults = [90, 60, 30].map((daysBefore) => ({
    id: `default-${daysBefore}`,
    organization_id: contract.organization_id,
    contract_id: contract.id,
    days_before: daysBefore,
    channel: "email" as const,
    enabled: true,
  }));

  const merged = schedules.length > 0 ? schedules : defaults;

  return merged
    .map((schedule) => ({
      ...schedule,
      upcoming_date: format(
        subDays(parseISO(contract.renewal_date), schedule.days_before),
        "PPP",
      ),
    }))
    .sort((a, b) => b.days_before - a.days_before);
}

function initialEditState(contract: Contract): EditFormState {
  return {
    vendor_name: contract.vendor_name,
    contract_type: contract.contract_type,
    annual_cost: contract.annual_cost?.toString() ?? "",
    renewal_date: contract.renewal_date,
    notice_period_days: contract.notice_period_days.toString(),
    auto_renewal: contract.auto_renewal,
    notes: contract.notes ?? "",
  };
}

export function ContractDetailClient({
  contract: initialContract,
  activityLogs: initialActivityLogs,
  reminderSchedules,
  currentProfileName,
}: ContractDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [contract, setContract] = useState(initialContract);
  const [activityLogs, setActivityLogs] = useState(initialActivityLogs);
  const [notes, setNotes] = useState(initialContract.notes ?? "");
  const [notesState, setNotesState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(
    initialEditState(initialContract),
  );
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newRenewalDate, setNewRenewalDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [localReminders, setLocalReminders] = useState(reminderSchedules);

  const daysLeft =
    contract.days_until_renewal ??
    differenceInCalendarDays(
      parseISO(contract.renewal_date),
      startOfDay(new Date()),
    );
  const noticeDeadline = getNoticeDeadline(contract);
  const monthlyEquivalent = getMonthlyEquivalent(contract.annual_cost);
  const reminderTimeline = useMemo(
    () => buildReminderTimeline(contract, localReminders),
    [contract, localReminders],
  );

  const addActivity = async (
    action: ActivityLog["action"],
    metadata: Record<string, unknown>,
  ) => {
    const payload = {
      organization_id: contract.organization_id,
      profile_id: contract.owner_id,
      contract_id: contract.id,
      action,
      metadata,
      created_at: new Date().toISOString(),
    };

    const { data } = await supabase
      .from("activity_logs")
      .insert(payload)
      .select(
        "id, organization_id, profile_id, contract_id, action, metadata, created_at, profile:profiles(*)",
      )
      .single();

    if (data) {
      setActivityLogs((current) => [normalizeActivityLog(data), ...current]);
    }
  };

  const handleSaveEdit = async () => {
    setIsSubmitting(true);

    const nextAnnualCost = Number(editForm.annual_cost);
    const nextNoticePeriod = Number(editForm.notice_period_days);

    const { data, error } = await supabase
      .from("contracts")
      .update({
        vendor_name: editForm.vendor_name,
        contract_type: editForm.contract_type,
        annual_cost: Number.isFinite(nextAnnualCost) ? nextAnnualCost : null,
        renewal_date: editForm.renewal_date,
        notice_period_days: Number.isFinite(nextNoticePeriod)
          ? nextNoticePeriod
          : contract.notice_period_days,
        auto_renewal: editForm.auto_renewal,
        notes: editForm.notes || null,
      })
      .eq("id", contract.id)
      .select("*")
      .single();

    if (!error && data) {
      const nextContract = data as Contract;
      const nextDaysLeft = differenceInCalendarDays(
        parseISO(nextContract.renewal_date),
        startOfDay(new Date()),
      );

      setContract({
        ...nextContract,
        days_until_renewal: nextDaysLeft,
      });
      setNotes(nextContract.notes ?? "");
      setIsEditOpen(false);
      await addActivity("updated", { source: "detail-edit-modal" });
      router.refresh();
    }

    setIsSubmitting(false);
  };

  const handleReminderToggle = async (item: ReminderSchedule) => {
    const nextEnabled = !item.enabled;

    setLocalReminders((current) =>
      current.map((schedule) =>
        schedule.id === item.id
          ? { ...schedule, enabled: nextEnabled }
          : schedule,
      ),
    );

    if (item.id.startsWith("default-")) {
      const { data } = await supabase
        .from("reminder_schedules")
        .insert({
          organization_id: contract.organization_id,
          contract_id: contract.id,
          days_before: item.days_before,
          channel: item.channel,
          enabled: nextEnabled,
        })
        .select("*")
        .single();

      if (data) {
        setLocalReminders((current) =>
          current.map((schedule) =>
            schedule.id === item.id ? (data as ReminderSchedule) : schedule,
          ),
        );
      }

      return;
    }

    await supabase
      .from("reminder_schedules")
      .update({ enabled: nextEnabled })
      .eq("id", item.id);
  };

  const handleNotesBlur = async () => {
    if (notes === (contract.notes ?? "")) {
      return;
    }

    setNotesState("saving");

    const { error } = await supabase
      .from("contracts")
      .update({ notes: notes || null })
      .eq("id", contract.id);

    if (error) {
      setNotesState("error");
      return;
    }

    setContract((current) => ({ ...current, notes: notes || null }));
    setNotesState("saved");
    await addActivity("updated", { field: "notes" });
    window.setTimeout(() => setNotesState("idle"), 2000);
  };

  const handleMarkRenewed = async () => {
    if (!newRenewalDate) {
      return;
    }

    setIsSubmitting(true);

    const { data: renewedRecord, error: insertError } = await supabase
      .from("contracts")
      .insert({
        organization_id: contract.organization_id,
        client_id: contract.client_id,
        owner_id: contract.owner_id,
        vendor_name: contract.vendor_name,
        contract_type: contract.contract_type,
        annual_cost: contract.annual_cost,
        currency: contract.currency,
        start_date: contract.start_date,
        renewal_date: newRenewalDate,
        notice_period_days: contract.notice_period_days,
        auto_renewal: contract.auto_renewal,
        status: "active",
        notes: contract.notes,
        pdf_url: contract.pdf_url,
        ai_extraction_data: contract.ai_extraction_data ?? null,
      })
      .select("*")
      .single();

    if (!insertError && renewedRecord) {
      await supabase
        .from("contracts")
        .update({ status: "renewed" })
        .eq("id", contract.id);
      await addActivity("renewed", { new_renewal_date: newRenewalDate });
      router.push(`/contracts/${(renewedRecord as Contract).id}`);
      router.refresh();
    }

    setIsSubmitting(false);
  };

  const handleMarkCancelled = async () => {
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("contracts")
      .update({ status: "cancelled" })
      .eq("id", contract.id)
      .select("*")
      .single();

    if (!error && data) {
      setContract((data as Contract) ?? contract);
      await addActivity("cancelled", { source: "detail-action" });
      router.refresh();
    }

    setCancelDialogOpen(false);
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    await addActivity("deleted", { source: "detail-action" });
    await supabase.from("contracts").delete().eq("id", contract.id);
    router.push("/contracts");
    router.refresh();
  };

  const handleStatusUpdate = async (status: ContractStatus) => {
    const { data, error } = await supabase
      .from("contracts")
      .update({ status })
      .eq("id", contract.id)
      .select("*")
      .single();

    if (!error && data) {
      setContract((data as Contract) ?? contract);
      await addActivity("updated", { status });
      router.refresh();
    }
  };

  const handleReplacePdf = async (file: File) => {
    setIsUploadingPdf(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("organizationId", contract.organization_id);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as
      | { error: string }
      | {
          storageUrl: string;
          extraction: Contract["ai_extraction_data"];
        };

    if (response.ok && "storageUrl" in payload) {
      const { data } = await supabase
        .from("contracts")
        .update({
          pdf_url: payload.storageUrl,
          ai_extraction_data: payload.extraction ?? null,
        })
        .eq("id", contract.id)
        .select("*")
        .single();

      if (data) {
        setContract((current) => ({
          ...(data as Contract),
          days_until_renewal: current.days_until_renewal,
        }));
        await addActivity("updated", { field: "pdf_url" });
      }
    }

    setIsUploadingPdf(false);
  };

  return (
    <div className="space-y-6">
      <nav className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link
          href="/contracts"
          className="hover:text-foreground transition-colors"
        >
          Contracts
        </Link>
        <span>&gt;</span>
        <span className="text-foreground">{contract.vendor_name}</span>
      </nav>

      <section className="flex flex-col gap-4 rounded-2xl border p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {contract.vendor_name}
              </h1>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  getTypeBadgeClass(contract.contract_type),
                )}
              >
                {getContractTypeLabel(contract.contract_type)}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  getStatusBadgeClass(contract.status),
                )}
              >
                {contract.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Contract record with renewal timelines, reminders, notes, and
              source document access.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="size-4" />
              Edit
            </Button>

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsActionMenuOpen((current) => !current)}
              >
                Actions
                <ChevronDown className="size-4" />
              </Button>

              {isActionMenuOpen ? (
                <div className="bg-background absolute right-0 z-20 mt-2 w-48 rounded-xl border p-2 shadow-lg">
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full rounded-lg px-3 py-2 text-left text-sm"
                    onClick={() => {
                      setRenewDialogOpen(true);
                      setIsActionMenuOpen(false);
                    }}
                  >
                    Renew
                  </button>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full rounded-lg px-3 py-2 text-left text-sm"
                    onClick={() => {
                      setCancelDialogOpen(true);
                      setIsActionMenuOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="hover:bg-muted text-destructive flex w-full rounded-lg px-3 py-2 text-left text-sm"
                    onClick={() => {
                      setDeleteDialogOpen(true);
                      setIsActionMenuOpen(false);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Renewal date</CardDescription>
            <CardTitle>
              {format(parseISO(contract.renewal_date), "PPP")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            <p>{daysLeft} days away</p>
            <p className="mt-1">
              Notice deadline: {format(noticeDeadline, "PPP")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Annual cost</CardDescription>
            <CardTitle>
              {formatCurrency(contract.annual_cost, contract.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {monthlyEquivalent !== null ? (
              <p>
                {formatCurrency(monthlyEquivalent, contract.currency)} monthly
                equivalent
              </p>
            ) : (
              <p>No cost recorded</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Notice period</CardDescription>
            <CardTitle>{contract.notice_period_days} days</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            <p>Cancel by {format(noticeDeadline, "PPP")}</p>
            <p className="mt-1">
              {daysLeft <= contract.notice_period_days
                ? "Within cancellation window"
                : "Outside cancellation window"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Auto-renewal</CardDescription>
            <CardTitle>
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-sm font-medium",
                  contract.auto_renewal
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800",
                )}
              >
                {contract.auto_renewal ? "Yes" : "No"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {contract.auto_renewal
              ? "Auto-renewal is enabled. Keep an eye on the notice deadline."
              : "No automatic rollover is expected."}
          </CardContent>
        </Card>
      </section>

      {daysLeft <= 60 ? (
        <section
          className={cn(
            "flex flex-col gap-4 rounded-2xl border px-5 py-4 lg:flex-row lg:items-center lg:justify-between",
            getUrgencyBannerClass(daysLeft),
          )}
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">
                This contract renews in {daysLeft} days. Action required by{" "}
                {format(noticeDeadline, "PPP")}.
              </p>
              <p className="mt-1 text-sm">
                Use the quick actions below to mark the contract as renewing or
                cancelling.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => handleStatusUpdate("renewed")}>
              <RefreshCw className="size-4" />
              Mark as Renewing
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleStatusUpdate("cancelled")}
            >
              Mark as Cancelling
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Reminder schedule</CardTitle>
              <CardDescription>
                Upcoming reminder points before renewal.
              </CardDescription>
            </div>
            <Link
              href="/settings"
              className="text-sm underline underline-offset-4"
            >
              Customize schedule
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {reminderTimeline.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                    <BellRing className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium">{item.upcoming_date}</p>
                    <p className="text-muted-foreground text-sm">
                      {item.days_before} days before
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => handleReminderToggle(item)}
                  />
                  {item.enabled ? "Enabled" : "Disabled"}
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Updates are saved when you leave the field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add context, negotiation notes, or owner guidance."
            />
            <p className="text-muted-foreground text-xs">
              {notesState === "saving"
                ? "Saving..."
                : notesState === "saved"
                  ? "Saved"
                  : notesState === "error"
                    ? "Unable to save notes"
                    : "Idle"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Document</CardTitle>
              <CardDescription>
                Review the uploaded contract file and replace it when a newer
                version is signed.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {contract.pdf_url ? (
                <a href={contract.pdf_url} target="_blank" rel="noreferrer">
                  <Button type="button" variant="outline">
                    <Download className="size-4" />
                    Download PDF
                  </Button>
                </a>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPdf}
              >
                {isUploadingPdf ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Replace PDF
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleReplacePdf(file);
                  }
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            {contract.pdf_url ? (
              <div className="overflow-hidden rounded-xl border">
                <Document
                  file={contract.pdf_url}
                  onLoadSuccess={({ numPages }) => setPdfPageCount(numPages)}
                  loading={
                    <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
                      Loading PDF preview...
                    </div>
                  }
                >
                  <Page
                    pageNumber={1}
                    width={720}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
                <div className="text-muted-foreground border-t px-4 py-3 text-sm">
                  Showing page 1{pdfPageCount ? ` of ${pdfPageCount}` : ""}.
                </div>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
                <FileText className="text-muted-foreground size-8" />
                <div>
                  <p className="font-medium">No PDF uploaded</p>
                  <p className="text-muted-foreground text-sm">
                    Add a contract file to preview and download it here.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity log</CardTitle>
            <CardDescription>
              Reverse-chronological timeline of contract changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityLogs.length > 0 ? (
              activityLogs.map((log) => (
                <div key={log.id} className="flex gap-3 rounded-xl border p-3">
                  <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
                    <Clock3 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">
                        {log.profile?.full_name ??
                          log.profile?.email ??
                          currentProfileName}
                      </span>{" "}
                      {log.action} on {format(parseISO(log.created_at), "PPP")}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {Object.keys(log.metadata ?? {}).length > 0
                        ? JSON.stringify(log.metadata)
                        : "No additional metadata"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                No activity has been recorded for this contract yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contract</DialogTitle>
            <DialogDescription>
              Update the core terms for this contract.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-vendor">Vendor name</Label>
              <Input
                id="edit-vendor"
                value={editForm.vendor_name}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    vendor_name: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type">Contract type</Label>
              <select
                id="edit-type"
                className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
                value={editForm.contract_type}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    contract_type: event.target
                      .value as Contract["contract_type"],
                  }))
                }
              >
                {[
                  "software_subscription",
                  "vendor_service",
                  "office_lease",
                  "equipment_lease",
                  "insurance",
                  "freelancer_retainer",
                  "professional_membership",
                  "other",
                ].map((option) => (
                  <option key={option} value={option}>
                    {getContractTypeLabel(option as Contract["contract_type"])}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-cost">Annual cost</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  value={editForm.annual_cost}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      annual_cost: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-renewal">Renewal date</Label>
                <Input
                  id="edit-renewal"
                  type="date"
                  value={editForm.renewal_date}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      renewal_date: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-notice">Notice period days</Label>
                <Input
                  id="edit-notice"
                  type="number"
                  value={editForm.notice_period_days}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      notice_period_days: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-renewal-toggle">Auto-renewal</Label>
                <select
                  id="edit-renewal-toggle"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={editForm.auto_renewal ? "yes" : "no"}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      auto_renewal: event.target.value === "yes",
                    }))
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as renewed</DialogTitle>
            <DialogDescription>
              What is the new renewal date? This creates a fresh active contract
              record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-renewal-date">New renewal date</Label>
            <Input
              id="new-renewal-date"
              type="date"
              value={newRenewalDate}
              onChange={(event) => setNewRenewalDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMarkRenewed}
              disabled={isSubmitting || !newRenewalDate}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Mark as Renewed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as cancelled</DialogTitle>
            <DialogDescription>
              This sets the contract status to cancelled and keeps the record
              for history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep contract
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleMarkCancelled}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Confirm cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contract</DialogTitle>
            <DialogDescription>
              This cannot be undone. The contract record and attached state will
              be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Keep contract
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
