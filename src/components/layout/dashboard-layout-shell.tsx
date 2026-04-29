"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
} from "lucide-react";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Organization, Profile } from "@/types";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

type DashboardLayoutShellProps = {
  children: ReactNode;
  profile: Profile;
  organization: Organization | null;
};

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/contracts/")) {
    return "Contract Details";
  }

  return (
    navigation.find((item) => matchesPath(pathname, item.href))?.label ??
    "ContractClock"
  );
}

function getInitials(profile: Profile) {
  const source = profile.full_name?.trim() || profile.email;
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return source.slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getPlanBadge(organization: Organization | null) {
  if (!organization) {
    return "Free";
  }

  if (organization.trial_ends_at) {
    const daysLeft = differenceInCalendarDays(
      parseISO(organization.trial_ends_at),
      startOfDay(new Date()),
    );

    if (daysLeft > 0) {
      return `${daysLeft} days left`;
    }
  }

  return organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1);
}

function shouldShowUpgrade(organization: Organization | null) {
  if (!organization) {
    return true;
  }

  if (organization.plan === "free") {
    return true;
  }

  if (!organization.trial_ends_at) {
    return false;
  }

  return (
    differenceInCalendarDays(
      parseISO(organization.trial_ends_at),
      startOfDay(new Date()),
    ) > 0
  );
}

type SidebarContentProps = {
  pathname: string;
  profile: Profile;
  organization: Organization | null;
  onNavigate?: () => void;
};

function SidebarContent({
  pathname,
  profile,
  organization,
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2">
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
          <Clock3 className="size-4" />
        </div>
        <span className="text-lg font-semibold">ContractClock</span>
      </div>

      <nav className="mt-8 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = matchesPath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 border-t pt-4">
        <div className="bg-muted inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium">
          {getPlanBadge(organization)}
        </div>
        <div className="bg-card flex items-center gap-3 rounded-xl border p-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full text-sm font-semibold">
            {getInitials(profile)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {profile.full_name ?? "ContractClock User"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {profile.email}
            </p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}

export function DashboardLayoutShell({
  children,
  profile,
  organization,
}: DashboardLayoutShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background h-screen overflow-hidden">
      <aside className="bg-card fixed inset-y-0 left-0 hidden w-60 border-r px-4 py-6 lg:block">
        <SidebarContent
          pathname={pathname}
          profile={profile}
          organization={organization}
        />
      </aside>

      <div className="flex h-full flex-col lg:pl-60">
        <header className="bg-background/95 flex h-[60px] items-center justify-between border-b px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="size-5" />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-4">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>
                    Navigate through your ContractClock workspace.
                  </SheetDescription>
                </SheetHeader>
                <SidebarContent
                  pathname={pathname}
                  profile={profile}
                  organization={organization}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <h1 className="text-xl font-semibold">{getPageTitle(pathname)}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
            </Button>
            {shouldShowUpgrade(organization) ? (
              <Button type="button">Upgrade</Button>
            ) : null}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
