"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  isBefore,
  startOfDay,
} from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { PDFUploadZone } from "@/components/contracts/PDFUploadZone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createContract } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";
import type { ContractAIExtractionData, ContractType } from "@/types";

const contractTypeOptions: Array<{ label: string; value: ContractType }> = [
  { label: "Software subscription", value: "software_subscription" },
  { label: "Vendor service", value: "vendor_service" },
  { label: "Office lease", value: "office_lease" },
  { label: "Equipment lease", value: "equipment_lease" },
  { label: "Insurance", value: "insurance" },
  { label: "Freelancer retainer", value: "freelancer_retainer" },
  { label: "Professional membership", value: "professional_membership" },
  { label: "Other", value: "other" },
];

const formSchema = z
  .object({
    vendor_name: z.string().min(2, "Vendor name must be at least 2 characters"),
    contract_type: z.enum([
      "software_subscription",
      "vendor_service",
      "office_lease",
      "equipment_lease",
      "insurance",
      "freelancer_retainer",
      "professional_membership",
      "other",
    ]),
    currency: z.enum(["GBP", "USD", "CAD"]),
    annual_cost: z.number().positive("Annual cost must be a positive number"),
    start_date: z.string().optional(),
    renewal_date: z.string().min(1, "Renewal date is required"),
    notice_period_value: z.number().int().positive("Notice period is required"),
    notice_period_unit: z.enum(["days", "weeks", "months"]),
    auto_renewal: z.enum(["yes", "no"]),
    owner_id: z.string().min(1, "Contract owner is required"),
    notes: z.string().optional(),
    use_monthly_cost: z.boolean(),
    monthly_cost: z.number().optional(),
  })
  .superRefine((values, ctx) => {
    const today = startOfDay(new Date());
    const renewalDate = values.renewal_date
      ? startOfDay(new Date(values.renewal_date))
      : null;

    if (renewalDate && isBefore(renewalDate, today)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["renewal_date"],
        message: "Renewal date must be today or in the future",
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;
type EntryMode = "manual" | "upload";

type AddContractModalProps = {
  organizationId: string;
  currentUser: { id: string; email: string; full_name: string | null };
  teamMembers: { id: string; email: string; full_name: string | null }[];
  triggerLabel?: string;
  trigger?: ReactNode;
};

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCancellationDate(
  renewalDate: string,
  value: number,
  unit: "days" | "weeks" | "months",
) {
  if (!renewalDate || !value) {
    return null;
  }

  const date = new Date(renewalDate);

  if (unit === "days") {
    return addDays(date, -value);
  }

  if (unit === "weeks") {
    return addWeeks(date, -value);
  }

  return addMonths(date, -value);
}

function initialFormValues(currentUserId: string): FormValues {
  return {
    vendor_name: "",
    contract_type: "software_subscription",
    annual_cost: 0,
    currency: "USD",
    start_date: "",
    renewal_date: "",
    notice_period_value: 30,
    notice_period_unit: "days",
    auto_renewal: "yes",
    owner_id: currentUserId,
    notes: "",
    use_monthly_cost: false,
    monthly_cost: undefined,
  };
}

export function AddContractModal({
  currentUser,
  teamMembers,
  organizationId,
  triggerLabel = "Add Contract",
  trigger,
}: AddContractModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [entryMode, setEntryMode] = useState<EntryMode>("manual");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [aiExtractionData, setAiExtractionData] =
    useState<ContractAIExtractionData | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormValues(currentUser.id),
  });

  const watchedRenewalDate = form.watch("renewal_date");
  const watchedNoticeValue = form.watch("notice_period_value");
  const watchedNoticeUnit = form.watch("notice_period_unit");
  const watchedUseMonthlyCost = form.watch("use_monthly_cost");
  const watchedMonthlyCost = form.watch("monthly_cost");

  const daysUntilRenewal = useMemo(() => {
    if (!watchedRenewalDate) {
      return null;
    }

    return differenceInCalendarDays(
      startOfDay(new Date(watchedRenewalDate)),
      startOfDay(new Date()),
    );
  }, [watchedRenewalDate]);

  const cancellationDate = useMemo(() => {
    if (!watchedRenewalDate || !watchedNoticeValue) {
      return null;
    }

    return getCancellationDate(
      watchedRenewalDate,
      watchedNoticeValue,
      watchedNoticeUnit,
    );
  }, [watchedNoticeUnit, watchedNoticeValue, watchedRenewalDate]);

  const handleCloseChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setStep(1);
      setEntryMode("manual");
      setSubmitError(null);
      setPdfUrl(null);
      setAiExtractionData(null);
      form.reset(initialFormValues(currentUser.id));
    }
  };

  const goNext = async () => {
    const valid = await form.trigger(
      step === 1
        ? ["vendor_name", "contract_type", "annual_cost", "currency"]
        : [
            "renewal_date",
            "notice_period_value",
            "notice_period_unit",
            "auto_renewal",
            "start_date",
          ],
    );

    if (valid) {
      setStep((current) => Math.min(current + 1, 3));
    }
  };

  const applyExtractionToForm = (extraction: ContractAIExtractionData) => {
    if (extraction.vendor_name) {
      form.setValue("vendor_name", extraction.vendor_name, {
        shouldValidate: true,
      });
    }

    if (extraction.contract_type) {
      form.setValue("contract_type", extraction.contract_type, {
        shouldValidate: true,
      });
    }

    if (extraction.currency) {
      form.setValue("currency", extraction.currency, { shouldValidate: true });
    }

    if (typeof extraction.annual_cost === "number") {
      form.setValue("annual_cost", extraction.annual_cost, {
        shouldValidate: true,
      });
      form.setValue("use_monthly_cost", false);
      form.setValue("monthly_cost", undefined);
    }

    if (extraction.start_date) {
      form.setValue("start_date", extraction.start_date);
    }

    if (extraction.renewal_date) {
      form.setValue("renewal_date", extraction.renewal_date, {
        shouldValidate: true,
      });
    }

    if (typeof extraction.notice_period_days === "number") {
      form.setValue("notice_period_value", extraction.notice_period_days, {
        shouldValidate: true,
      });
      form.setValue("notice_period_unit", "days");
    }

    if (typeof extraction.auto_renewal === "boolean") {
      form.setValue("auto_renewal", extraction.auto_renewal ? "yes" : "no", {
        shouldValidate: true,
      });
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      if (!organizationId) {
        throw new Error("Organization is required before a contract can be created.");
      }

      const supabase = createClient();
      const annualCost =
        values.use_monthly_cost && values.monthly_cost
          ? Number((values.monthly_cost * 12).toFixed(2))
          : values.annual_cost;

      await createContract(supabase, {
        organization_id: organizationId,
        client_id: null,
        owner_id: values.owner_id,
        vendor_name: values.vendor_name,
        contract_type: values.contract_type,
        annual_cost: annualCost,
        currency: values.currency,
        start_date: values.start_date ? new Date(values.start_date).toISOString().slice(0, 10) : null,
        renewal_date: new Date(values.renewal_date).toISOString().slice(0, 10),
        notice_period_days:
          values.notice_period_unit === "days"
            ? values.notice_period_value
            : values.notice_period_unit === "weeks"
              ? values.notice_period_value * 7
              : values.notice_period_value * 30,
        auto_renewal: values.auto_renewal === "yes",
        status: "active",
        notes: values.notes || null,
        pdf_url: pdfUrl,
        ai_extraction_data: aiExtractionData,
      });

      setOpen(false);
      setToastVisible(true);
      router.refresh();
      window.setTimeout(() => setToastVisible(false), 3000);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save contract.",
      );
    }
  });

  const monthlyToggleHandler = (checked: boolean) => {
    form.setValue("use_monthly_cost", checked);

    if (checked) {
      const annual = form.getValues("annual_cost");
      form.setValue(
        "monthly_cost",
        annual > 0 ? Number((annual / 12).toFixed(2)) : undefined,
      );
    } else {
      const monthly = form.getValues("monthly_cost");
      form.setValue(
        "annual_cost",
        monthly ? Number((monthly * 12).toFixed(2)) : 0,
        {
          shouldValidate: true,
        },
      );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseChange}>
        {trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button type="button">
              <Plus className="size-4" />
              {triggerLabel}
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add contract</DialogTitle>
            <DialogDescription>
              Start manually or upload a PDF and let ContractClock pre-fill the
              details for you.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs font-medium">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border",
                    item <= step
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {item}
                </div>
                {item < 3 ? <div className="bg-border h-px w-8" /> : null}
              </div>
            ))}
          </div>

          <form className="space-y-6" onSubmit={onSubmit}>
            {step === 1 ? (
              <div className="space-y-5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors",
                      entryMode === "manual"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                    onClick={() => setEntryMode("manual")}
                  >
                    <p className="font-medium">Enter manually</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Add the contract details yourself.
                    </p>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors",
                      entryMode === "upload"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                    onClick={() => setEntryMode("upload")}
                  >
                    <p className="font-medium">
                      Upload PDF — we&apos;ll read it for you
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Extract contract details with AI, then review them.
                    </p>
                  </button>
                </div>

                {entryMode === "upload" ? (
                  <div className="space-y-4">
                    <PDFUploadZone
                      organizationId={organizationId}
                      onExtracted={({ extraction, pdfUrl: nextPdfUrl }) => {
                        setAiExtractionData(extraction);
                        setPdfUrl(nextPdfUrl);
                        applyExtractionToForm(extraction);
                        setSubmitError(null);
                      }}
                    />

                    {aiExtractionData ? (
                      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        <Sparkles className="mt-0.5 size-4 shrink-0" />
                        <div>
                          <p className="font-medium">
                            Fields pre-filled from your PDF
                          </p>
                          <p className="mt-1">
                            Review the values below and keep moving through the
                            form before saving.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor_name">Vendor/supplier name</Label>
                    <Input id="vendor_name" {...form.register("vendor_name")} />
                    {form.formState.errors.vendor_name ? (
                      <p className="text-destructive text-sm">
                        {form.formState.errors.vendor_name.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contract_type">Contract type</Label>
                    <select
                      id="contract_type"
                      className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      {...form.register("contract_type")}
                    >
                      {contractTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="annual_cost">
                        {watchedUseMonthlyCost ? "Monthly cost" : "Annual cost"}
                      </Label>
                      <button
                        type="button"
                        className="text-sm underline underline-offset-4"
                        onClick={() =>
                          monthlyToggleHandler(!watchedUseMonthlyCost)
                        }
                      >
                        {watchedUseMonthlyCost
                          ? "Enter annual cost instead"
                          : "Or enter monthly cost"}
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
                      <Controller
                        control={form.control}
                        name={
                          watchedUseMonthlyCost ? "monthly_cost" : "annual_cost"
                        }
                        render={({ field }) => (
                          <Input
                            id="annual_cost"
                            type="number"
                            min="0"
                            step="0.01"
                            value={field.value ?? ""}
                            onChange={(event) => {
                              const nextValue = parseNumber(event.target.value);
                              field.onChange(nextValue);

                              if (watchedUseMonthlyCost) {
                                form.setValue(
                                  "annual_cost",
                                  Number((nextValue * 12).toFixed(2)),
                                  {
                                    shouldValidate: true,
                                  },
                                );
                              }
                            }}
                          />
                        )}
                      />
                      <select
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        {...form.register("currency")}
                      >
                        <option value="GBP">GBP</option>
                        <option value="USD">USD</option>
                        <option value="CAD">CAD</option>
                      </select>
                    </div>

                    {watchedUseMonthlyCost && watchedMonthlyCost ? (
                      <p className="text-muted-foreground text-sm">
                        Annualized automatically: {form.getValues("currency")}{" "}
                        {Number(
                          (watchedMonthlyCost * 12).toFixed(2),
                        ).toLocaleString()}
                      </p>
                    ) : null}

                    {form.formState.errors.annual_cost ? (
                      <p className="text-destructive text-sm">
                        {form.formState.errors.annual_cost.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Contract start date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      {...form.register("start_date")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="renewal_date">Renewal date</Label>
                    <Input
                      id="renewal_date"
                      type="date"
                      {...form.register("renewal_date")}
                    />
                    {form.formState.errors.renewal_date ? (
                      <p className="text-destructive text-sm">
                        {form.formState.errors.renewal_date.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="bg-muted/40 rounded-xl border p-4 text-sm">
                  <p className="font-medium">Computed timeline</p>
                  <p className="text-muted-foreground mt-2">
                    {daysUntilRenewal !== null
                      ? `${daysUntilRenewal} days until renewal`
                      : "Choose a renewal date"}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Cancellation deadline:{" "}
                    {cancellationDate ? format(cancellationDate, "PPP") : "-"}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <div className="space-y-2">
                    <Label htmlFor="notice_period_value">Notice period</Label>
                    <Controller
                      control={form.control}
                      name="notice_period_value"
                      render={({ field }) => (
                        <Input
                          id="notice_period_value"
                          type="number"
                          min="1"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(parseNumber(event.target.value))
                          }
                        />
                      )}
                    />
                    {form.formState.errors.notice_period_value ? (
                      <p className="text-destructive text-sm">
                        {form.formState.errors.notice_period_value.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notice_period_unit">Unit</Label>
                    <select
                      id="notice_period_unit"
                      className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      {...form.register("notice_period_unit")}
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Auto-renewal</Label>
                  <div className="flex gap-3">
                    {[
                      { label: "Yes", value: "yes" },
                      { label: "No", value: "no" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <input
                          type="radio"
                          value={option.value}
                          {...form.register("auto_renewal")}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="owner_id">Contract owner</Label>
                  <select
                    id="owner_id"
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    {...form.register("owner_id")}
                  >
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name ?? member.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional notes, exceptions, or renewal context"
                    {...form.register("notes")}
                  />
                </div>

                {pdfUrl ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-medium">PDF attached</p>
                    <p className="mt-1 break-all">{pdfUrl}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {submitError ? (
              <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            ) : null}

            <DialogFooter>
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((current) => current - 1)}
                >
                  Back
                </Button>
              ) : null}
              {step < 3 ? (
                <Button type="button" onClick={goNext}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save Contract
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {toastVisible ? (
        <div className="bg-background fixed right-4 bottom-4 z-[60] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <span className="text-sm font-medium">Contract added</span>
        </div>
      ) : null}
    </>
  );
}
