import { FileClock, BellRing, ChartNoAxesCombined, Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const metrics = [
  {
    label: "Active contracts",
    value: "128",
    description: "Across procurement, vendor, and customer workflows",
    icon: FileClock,
  },
  {
    label: "Reminders due",
    value: "9",
    description: "Renewals and signature follow-ups in the next 14 days",
    icon: BellRing,
  },
  {
    label: "Pipeline value",
    value: "$420k",
    description: "Draft and review stage commercial agreements",
    icon: Wallet,
  },
  {
    label: "Approval speed",
    value: "3.4d",
    description: "Average turnaround time this month",
    icon: ChartNoAxesCombined,
  },
];

export function DashboardOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{metric.label}</CardTitle>
                <CardDescription>{metric.description}</CardDescription>
              </div>
              <Icon className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                {metric.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
