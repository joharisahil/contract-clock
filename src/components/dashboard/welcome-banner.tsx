"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WelcomeBanner() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  return (
    <div className="from-primary/10 via-background to-background relative overflow-hidden rounded-2xl border bg-gradient-to-r p-6">
      <div className="absolute top-4 right-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setVisible(false);
            router.replace("/dashboard");
          }}
          aria-label="Dismiss welcome banner"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3.5" />
            Welcome
          </div>
          <div>
            <h2 className="text-xl font-semibold">Welcome to ContractClock!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Add your first contract to start tracking.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/contracts" className={cn(buttonVariants())}>
            Add Contract
          </Link>
        </div>
      </div>
    </div>
  );
}
