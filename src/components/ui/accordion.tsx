"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type AccordionContextValue = {
  openId: string | null;
  setOpenId: React.Dispatch<React.SetStateAction<string | null>>;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function Accordion({
  children,
  className,
  defaultValue,
}: React.PropsWithChildren<{ className?: string; defaultValue?: string }>) {
  const [openId, setOpenId] = React.useState<string | null>(defaultValue ?? null);

  return (
    <AccordionContext.Provider value={{ openId, setOpenId }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

function AccordionItem({
  children,
  value,
  className,
}: React.PropsWithChildren<{ value: string; className?: string }>) {
  return (
    <div className={cn("border-b last:border-b-0", className)} data-value={value}>
      {children}
    </div>
  );
}

function AccordionTrigger({
  children,
  className,
  value,
}: React.PropsWithChildren<{ className?: string; value?: string }>) {
  const context = React.useContext(AccordionContext);
  const itemValue = value ?? "";
  const open = context?.openId === itemValue;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-medium",
        className,
      )}
      onClick={() =>
        context?.setOpenId((current) => (current === itemValue ? null : itemValue))
      }
    >
      <span>{children}</span>
      <ChevronDown
        className={cn("size-4 shrink-0 transition-transform", open ? "rotate-180" : "")}
      />
    </button>
  );
}

function AccordionContent({
  children,
  className,
  value,
}: React.PropsWithChildren<{ className?: string; value?: string }>) {
  const context = React.useContext(AccordionContext);
  const itemValue = value ?? "";
  const open = context?.openId === itemValue;

  if (!open) {
    return null;
  }

  return <div className={cn("pb-4 text-sm text-muted-foreground", className)}>{children}</div>;
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
