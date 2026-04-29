"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Contract } from "@/types";

type CalendarEvent = {
  id: string;
  contractId: string;
  kind: "renewal" | "reminder";
  title: string;
  date: string;
  vendorName: string;
  annualCost: number | null;
  currency: string;
  daysLeft: number;
  noticeDeadline: string;
  reminderDaysBefore?: number;
  contract: Contract;
};

type CalendarClientProps = {
  contracts: Contract[];
  currency: string;
};

const DEFAULT_REMINDER_SCHEDULE = [90, 60, 30, 14, 7];

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

function getUrgencyClasses(daysLeft: number, kind: CalendarEvent["kind"]) {
  const base =
    kind === "reminder"
      ? "border border-dashed bg-transparent"
      : "border border-transparent";

  if (daysLeft < 14) {
    return `${base} border-red-200 bg-red-100 text-red-700`;
  }

  if (daysLeft < 30) {
    return `${base} border-amber-200 bg-amber-100 text-amber-700`;
  }

  if (daysLeft < 60) {
    return `${base} border-yellow-200 bg-yellow-100 text-yellow-700`;
  }

  return `${base} border-emerald-200 bg-emerald-100 text-emerald-700`;
}

function buildIcs(events: CalendarEvent[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ContractClock//Renewal Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events
    .filter((event) => event.kind === "renewal")
    .forEach((event) => {
      const date = event.date.replaceAll("-", "");
      const description = `Annual cost: ${formatCurrency(event.annualCost, event.currency)}\\nNotice deadline: ${event.noticeDeadline}`;

      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.id}@contractclock`,
        `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${date}`,
        `SUMMARY:${event.vendorName} renewal`,
        `DESCRIPTION:${description}`,
        "BEGIN:VALARM",
        "TRIGGER:-P7D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${event.vendorName} renewal in 7 days`,
        "END:VALARM",
        "END:VEVENT",
      );
    });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CalendarClient({ contracts, currency }: CalendarClientProps) {
  const [view, setView] = useState<"list" | "month" | "week">("list");
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const events = useMemo(() => {
    const today = startOfDay(new Date());
    const inTwelveMonths = addMonths(today, 12);
    const nextEvents: CalendarEvent[] = [];

    contracts.forEach((contract) => {
      const renewalDate = parseISO(contract.renewal_date);

      if (isBefore(renewalDate, today) || isAfter(renewalDate, inTwelveMonths)) {
        return;
      }

      const daysLeft = differenceInCalendarDays(renewalDate, today);
      const noticeDeadline = format(
        addDays(renewalDate, -contract.notice_period_days),
        "yyyy-MM-dd",
      );

      nextEvents.push({
        id: `${contract.id}-renewal`,
        contractId: contract.id,
        kind: "renewal",
        title: `${contract.vendor_name} renewal`,
        date: contract.renewal_date,
        vendorName: contract.vendor_name,
        annualCost: contract.annual_cost,
        currency: contract.currency,
        daysLeft,
        noticeDeadline,
        contract,
      });

      DEFAULT_REMINDER_SCHEDULE.forEach((daysBefore) => {
        const reminderDate = addDays(renewalDate, -daysBefore);

        if (isBefore(reminderDate, today) || isAfter(reminderDate, inTwelveMonths)) {
          return;
        }

        nextEvents.push({
          id: `${contract.id}-reminder-${daysBefore}`,
          contractId: contract.id,
          kind: "reminder",
          title: `${contract.vendor_name} reminder`,
          date: format(reminderDate, "yyyy-MM-dd"),
          vendorName: contract.vendor_name,
          annualCost: contract.annual_cost,
          currency: contract.currency,
          daysLeft,
          noticeDeadline,
          reminderDaysBefore: daysBefore,
          contract,
        });
      });
    });

    return nextEvents.sort((a, b) => a.date.localeCompare(b.date));
  }, [contracts]);

  const groupedListEvents = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();

    events.forEach((event) => {
      const key = format(parseISO(event.date), "MMMM yyyy");
      groups.set(key, [...(groups.get(key) ?? []), event]);
    });

    return Array.from(groups.entries());
  }, [events]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthCursor]);

  const weekEvents = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    return events.filter((event) => {
      const date = parseISO(event.date);
      return !isBefore(date, weekStart) && !isAfter(date, weekEnd);
    });
  }, [events]);

  const handleIcalDownload = () => {
    downloadFile("contractclock-renewals.ics", buildIcs(events), "text/calendar");
  };

  const handleGoogleCalendarExport = () => {
    handleIcalDownload();
    window.open(
      "https://calendar.google.com/calendar/u/0/r/settings/export",
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["month", "week", "list"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={view === option ? "default" : "outline"}
                onClick={() => setView(option)}
              >
                {option === "month"
                  ? "Month view"
                  : option === "week"
                    ? "Week view"
                    : "List view"}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleGoogleCalendarExport}>
              <ExternalLink className="size-4" />
              Export to Google Calendar
            </Button>
            <Button type="button" variant="outline" onClick={handleIcalDownload}>
              <Download className="size-4" />
              Download iCal file
            </Button>
          </div>
        </div>

        {view === "month" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{format(monthCursor, "MMMM yyyy")}</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthCursor((current) => addMonths(current, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthCursor((current) => addMonths(current, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="px-2 py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {monthDays.map((day) => {
                  const dayEvents = events.filter((event) =>
                    isSameDay(parseISO(event.date), day),
                  );

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-32 rounded-2xl border p-2",
                        !isSameMonth(day, monthCursor) ? "bg-muted/20 text-muted-foreground" : "",
                      )}
                    >
                      <p className="mb-2 text-sm font-medium">{format(day, "d")}</p>
                      <div className="space-y-1">
                        {dayEvents.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            className={cn(
                              "w-full rounded-lg px-2 py-1 text-left text-xs font-medium",
                              getUrgencyClasses(event.daysLeft, event.kind),
                            )}
                            onClick={() => setSelectedEvent(event)}
                          >
                            {event.vendorName}
                            {event.kind === "reminder" && event.reminderDaysBefore
                              ? ` · ${event.reminderDaysBefore}d`
                              : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {view === "week" ? (
          <Card>
            <CardHeader>
              <CardTitle>This week</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {weekEvents.length > 0 ? (
                weekEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div>
                      <p className="font-medium">
                        {format(parseISO(event.date), "EEE, MMM d")} · {event.vendorName}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {event.kind === "renewal"
                          ? "Renewal date"
                          : `${event.reminderDaysBefore} day reminder`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        getUrgencyClasses(event.daysLeft, event.kind),
                      )}
                    >
                      {event.daysLeft} days left
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  No renewals or reminder dates fall in the current week.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {view === "list" ? (
          <div className="space-y-6">
            {groupedListEvents.map(([month, monthEvents]) => (
              <Card key={month}>
                <CardHeader>
                  <CardTitle>{month}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {monthEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-muted/30"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="grid gap-1">
                        <p className="font-medium">
                          {format(parseISO(event.date), "MMM d")} · {event.vendorName}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {event.kind === "renewal"
                            ? "Renewal date"
                            : `Reminder email (${event.reminderDaysBefore} days before)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">
                          {formatCurrency(event.annualCost, event.currency)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            getUrgencyClasses(event.daysLeft, event.kind),
                          )}
                        >
                          {event.daysLeft} days left
                        </span>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>

      <Sheet open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="w-[420px] sm:w-[480px]">
          {selectedEvent ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedEvent.vendorName}</SheetTitle>
                <SheetDescription>
                  {selectedEvent.kind === "renewal"
                    ? "Renewal date"
                    : `${selectedEvent.reminderDaysBefore} day reminder`}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 text-sm">
                <div className="rounded-2xl border p-4">
                  <p className="text-muted-foreground">Date</p>
                  <p className="mt-1 font-medium">
                    {format(parseISO(selectedEvent.date), "PPP")}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-muted-foreground">Annual cost</p>
                  <p className="mt-1 font-medium">
                    {formatCurrency(selectedEvent.annualCost, selectedEvent.currency)}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-muted-foreground">Notice deadline</p>
                  <p className="mt-1 font-medium">{selectedEvent.noticeDeadline}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-muted-foreground">Status</p>
                  <p className="mt-1 font-medium capitalize">
                    {selectedEvent.contract.status.replaceAll("_", " ")}
                  </p>
                </div>
                {selectedEvent.contract.notes ? (
                  <div className="rounded-2xl border p-4">
                    <p className="text-muted-foreground">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap">{selectedEvent.contract.notes}</p>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Link
                    href={`/contracts/${selectedEvent.contractId}`}
                    className={cn(buttonVariants(), "flex-1")}
                  >
                    Open contract
                  </Link>
                  {selectedEvent.contract.pdf_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        window.open(
                          selectedEvent.contract.pdf_url ?? "",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Open PDF
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
