"use client";

import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PlanType } from "@/types";

type UpgradeModalProps = {
  trigger?: React.ReactNode;
  triggerLabel?: string;
};

const plans: Array<{
  name: Exclude<PlanType, "free">;
  label: string;
  monthly: string;
  yearly: string;
  features: string[];
  highlighted?: boolean;
}> = [
  {
    name: "starter",
    label: "Starter",
    monthly: "$19",
    yearly: "$15",
    features: ["More contracts", "Core reminders", "Simple renewal tracking"],
  },
  {
    name: "pro",
    label: "Pro",
    monthly: "$49",
    yearly: "$39",
    features: ["Team collaboration", "Owner filters", "Advanced tracking"],
    highlighted: true,
  },
  {
    name: "business",
    label: "Business",
    monthly: "$99",
    yearly: "$79",
    features: ["More seats", "More workflows", "Operational visibility"],
  },
  {
    name: "agency",
    label: "Agency",
    monthly: "$199",
    yearly: "$159",
    features: ["Portfolio scale", "Multi-client ops", "Priority support"],
  },
];

export function UpgradeModal({
  trigger,
  triggerLabel = "Upgrade",
}: UpgradeModalProps) {
  const [open, setOpen] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const planCards = useMemo(() => plans, []);

  async function handleCheckout(plan: Exclude<PlanType, "free">) {
    setLoadingPlan(plan);

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, interval }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to start checkout");
      }

      window.location.href = payload.url;
    } catch (error) {
      console.error("[billing] Checkout failed", error);
      setLoadingPlan(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>{triggerLabel}</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Upgrade ContractClock</DialogTitle>
          <DialogDescription>
            Choose the plan that fits your renewal workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium",
              interval === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
            onClick={() => setInterval("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium",
              interval === "yearly" ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
            onClick={() => setInterval("yearly")}
          >
            Yearly
          </button>
          {interval === "yearly" ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Save 20%
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {planCards.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "rounded-2xl border p-5",
                plan.highlighted ? "border-primary shadow-sm" : "border-border",
              )}
            >
              {plan.highlighted ? (
                <div className="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Most popular
                </div>
              ) : null}
              <h3 className="text-xl font-semibold">{plan.label}</h3>
              <p className="mt-2 text-3xl font-bold">
                {interval === "monthly" ? plan.monthly : plan.yearly}
                <span className="text-muted-foreground text-sm font-medium">
                  /mo
                </span>
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                disabled={loadingPlan !== null}
                onClick={() => handleCheckout(plan.name)}
              >
                {loadingPlan === plan.name ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Choose {plan.label}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
