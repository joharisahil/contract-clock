"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { PLAN_CONTRACT_LIMITS } from "@/lib/stripe/constants";
import { cn } from "@/lib/utils";
import type { Contract, Organization, PlanType, Profile, UserRole } from "@/types";

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  joined_at: string | null;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  hosted_invoice_url: string | null;
};

type SettingsClientProps = {
  profile: Profile;
  organization: Organization;
  contracts: Contract[];
  teamMembers: TeamMember[];
  pendingInvitations: PendingInvitation[];
  invoices: InvoiceRow[];
  slackWebhook: string;
  reminderDefaults: number[];
  weeklyDigestEnabled: boolean;
  digestTime: string;
};

const tabs = [
  "profile",
  "notifications",
  "team",
  "billing",
  "integrations",
  "danger",
] as const;

type TabKey = (typeof tabs)[number];

function formatCurrency(value: number | null, currency = "USD") {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function initials(profile: Profile) {
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

function daysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  const diff = Math.ceil(
    (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff > 0 ? diff : null;
}

export function SettingsClient({
  profile,
  organization,
  contracts,
  teamMembers,
  pendingInvitations,
  invoices,
  slackWebhook,
  reminderDefaults,
  weeklyDigestEnabled,
  digestTime,
}: SettingsClientProps) {
  const supabase = createClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [currency, setCurrency] = useState<Profile["currency"]>(profile.currency);
  const [profileLoading, setProfileLoading] = useState(false);
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(true);
  const [selectedReminderDays, setSelectedReminderDays] = useState<number[]>(reminderDefaults);
  const [webhookUrl, setWebhookUrl] = useState(slackWebhook);
  const [digestEnabled, setDigestEnabled] = useState(weeklyDigestEnabled);
  const [digestDeliveryTime, setDigestDeliveryTime] = useState(digestTime);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("member");
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const timezones = useMemo(() => {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
    return [profile.timezone];
  }, [profile.timezone]);

  const usageLimit = PLAN_CONTRACT_LIMITS[organization.plan];
  const usagePercent =
    usageLimit >= 999999 ? 12 : Math.min(100, Math.round((contracts.length / usageLimit) * 100));
  const trialDays = daysRemaining(organization.trial_ends_at);
  const isProPlus =
    organization.plan === "pro" ||
    organization.plan === "business" ||
    organization.plan === "agency";

  async function saveProfile() {
    setProfileLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          timezone,
          currency,
        })
        .eq("id", profile.id);

      if (error) throw error;
      router.refresh();
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveNotificationDefaults(applyToAll = false) {
    const organizationSettings = {
      organization_id: organization.id,
      email_reminders_enabled: emailRemindersEnabled,
      weekly_digest_enabled: digestEnabled,
      weekly_digest_time: digestDeliveryTime,
      slack_webhook: webhookUrl || null,
    };

    await supabase.from("organization_settings").upsert(organizationSettings);

    await supabase
      .from("organizations")
      .update({ slack_webhook: webhookUrl || null })
      .eq("id", organization.id);

    await supabase
      .from("reminder_schedules")
      .delete()
      .eq("organization_id", organization.id)
      .is("contract_id", null);

    if (selectedReminderDays.length > 0) {
      await supabase.from("reminder_schedules").insert(
        selectedReminderDays.map((days) => ({
          organization_id: organization.id,
          contract_id: null,
          days_before: days,
          channel: "email",
          enabled: emailRemindersEnabled,
        })),
      );
    }

    if (applyToAll) {
      await supabase
        .from("reminder_schedules")
        .delete()
        .eq("organization_id", organization.id)
        .not("contract_id", "is", null);

      if (selectedReminderDays.length > 0) {
        await supabase.from("reminder_schedules").insert(
          contracts.flatMap((contract) =>
            selectedReminderDays.map((days) => ({
              organization_id: organization.id,
              contract_id: contract.id,
              days_before: days,
              channel: "email",
              enabled: emailRemindersEnabled,
            })),
          ),
        );
      }
    }

    router.refresh();
  }

  async function testSlack() {
    setTestingSlack(true);

    try {
      await fetch("/api/settings/slack-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
    } finally {
      setTestingSlack(false);
    }
  }

  async function sendInvite() {
    if (!inviteEmail) return;
    setSubmittingInvite(true);

    try {
      await supabase.from("organization_invitations").insert({
        organization_id: organization.id,
        email: inviteEmail,
        role: inviteRole,
        invited_by: profile.id,
      });
      setInviteEmail("");
      setInviteRole("member");
      router.refresh();
    } finally {
      setSubmittingInvite(false);
    }
  }

  async function removeMember(memberId: string) {
    await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", organization.id)
      .eq("profile_id", memberId);
    router.refresh();
  }

  async function resendInvite(inviteId: string) {
    await supabase
      .from("organization_invitations")
      .update({ created_at: new Date().toISOString() })
      .eq("id", inviteId);
    router.refresh();
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from("organization_invitations").delete().eq("id", inviteId);
    router.refresh();
  }

  async function openBillingPortal() {
    setBillingLoading(true);

    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string };
      if (payload.url) {
        window.location.href = payload.url;
      }
    } finally {
      setBillingLoading(false);
    }
  }

  function exportAllData() {
    const rows = [
      ["Vendor", "Type", "Annual Cost", "Currency", "Renewal Date", "Status", "Notes"],
      ...contracts.map((contract) => [
        contract.vendor_name,
        contract.contract_type,
        String(contract.annual_cost ?? ""),
        contract.currency,
        contract.renewal_date,
        contract.status,
        contract.notes ?? "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contractclock-data.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    setDeletingAccount(true);

    try {
      const response = await fetch("/api/settings/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: deleteEmail }),
      });

      if (response.ok) {
        window.location.href = "/login";
      }
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn(
              "w-full rounded-xl px-4 py-3 text-left text-sm font-medium capitalize transition-colors",
              activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "danger" ? "Danger zone" : tab}
          </button>
        ))}
      </aside>

      <div className="space-y-6">
        {activeTab === "profile" ? (
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your personal defaults and identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full text-lg font-semibold">
                  {initials(profile)}
                </div>
                <div>
                  <p className="font-medium">{profile.full_name ?? profile.email}</p>
                  <p className="text-muted-foreground text-sm">Profile picture placeholder for MVP</p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile.email} readOnly />
                  <Link href="/login" className="text-sm underline underline-offset-4">
                    Change email
                  </Link>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    className="border-input bg-background h-10 w-full rounded-md border px-3 py-2 text-sm"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {timezones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Default currency</Label>
                  <div className="flex gap-4">
                    {(["GBP", "USD", "CAD"] as const).map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={currency === option}
                          onChange={() => setCurrency(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <Button onClick={saveProfile} disabled={profileLoading}>
                {profileLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Save changes
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "notifications" ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email reminders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <span className="font-medium">Global on/off</span>
                  <input
                    type="checkbox"
                    checked={emailRemindersEnabled}
                    onChange={(e) => setEmailRemindersEnabled(e.target.checked)}
                  />
                </label>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Default reminder schedule</p>
                  <div className="flex flex-wrap gap-3">
                    {[90, 60, 30, 14, 7].map((days) => (
                      <label key={days} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedReminderDays.includes(days)}
                          onChange={() =>
                            setSelectedReminderDays((current) =>
                              current.includes(days)
                                ? current.filter((value) => value !== days)
                                : [...current, days].sort((a, b) => b - a),
                            )
                          }
                        />
                        {days} days
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => saveNotificationDefaults(false)}>
                    Save defaults
                  </Button>
                  <Button onClick={() => saveNotificationDefaults(true)}>
                    Apply to all contracts
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slack</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook">Webhook URL</Label>
                  <Input
                    id="webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", webhookUrl ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                    {webhookUrl ? "Connected" : "Not connected"}
                  </span>
                  <Button variant="outline" onClick={testSlack} disabled={!webhookUrl || testingSlack}>
                    {testingSlack ? <Loader2 className="size-4 animate-spin" /> : null}
                    Test notification
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Digest</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <span className="font-medium">Send me a weekly digest every Monday morning</span>
                  <input
                    type="checkbox"
                    checked={digestEnabled}
                    onChange={(e) => setDigestEnabled(e.target.checked)}
                  />
                </label>
                <div className="space-y-2">
                  <Label htmlFor="digest_time">Digest delivery time</Label>
                  <Input
                    id="digest_time"
                    type="time"
                    value={digestDeliveryTime}
                    onChange={(e) => setDigestDeliveryTime(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "team" ? (
          isProPlus ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="grid grid-cols-[48px_minmax(0,1fr)_120px_130px_100px] items-center gap-3 rounded-xl border px-4 py-3 text-sm">
                      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full font-semibold">
                        {(member.full_name ?? member.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{member.full_name ?? member.email}</p>
                        <p className="text-muted-foreground">{member.email}</p>
                      </div>
                      <p className="capitalize">{member.role}</p>
                      <p className="text-muted-foreground">
                        {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "-"}
                      </p>
                      <Button variant="outline" size="sm" onClick={() => removeMember(member.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Invite team member</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_160px]">
                  <Input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@company.com"
                  />
                  <select
                    className="border-input bg-background h-10 rounded-md border px-3 py-2 text-sm"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  >
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button onClick={sendInvite} disabled={submittingInvite}>
                    {submittingInvite ? <Loader2 className="size-4 animate-spin" /> : null}
                    Send invite
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pending invitations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingInvitations.length > 0 ? (
                    pendingInvitations.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium">{invite.email}</p>
                          <p className="text-muted-foreground capitalize">
                            {invite.role} · {new Date(invite.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => resendInvite(invite.id)}>
                            Resend
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => cancelInvite(invite.id)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No pending invitations.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
                <CardDescription>Upgrade to Pro to add team members.</CardDescription>
              </CardHeader>
              <CardContent>
                <UpgradeModal triggerLabel="Upgrade to Pro" />
              </CardContent>
            </Card>
          )
        ) : null}

        {activeTab === "billing" ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium capitalize">
                    {organization.plan}
                  </span>
                  {trialDays ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                      {trialDays} days remaining
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {contracts.length} of {usageLimit >= 999999 ? "Unlimited" : usageLimit} contracts used
                    </span>
                    <span>{usagePercent}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted">
                    <div
                      className="bg-primary h-3 rounded-full transition-all"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {(organization.plan === "free" || organization.plan === "starter") ? (
                    <UpgradeModal />
                  ) : null}
                  <Button variant="outline" onClick={openBillingPortal} disabled={billingLoading}>
                    {billingLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                    Manage Billing
                  </Button>
                </div>
              </CardContent>
            </Card>

            {organization.plan === "free" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Pricing comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-4 text-sm">
                    {[
                      ["Starter", "25 contracts", "Solo teams growing beyond the free tier"],
                      ["Pro", "100 contracts", "Collaboration and owner visibility"],
                      ["Business", "Unlimited", "Operational scale and more control"],
                      ["Agency", "Unlimited", "Portfolio workflows across many clients"],
                    ].map(([name, limit, copy]) => (
                      <div key={name} className="rounded-2xl border p-4">
                        <p className="font-semibold">{name}</p>
                        <p className="mt-1 text-muted-foreground">{limit}</p>
                        <p className="mt-3 text-muted-foreground">{copy}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Invoice history</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr key={invoice.id} className="border-t">
                            <td className="px-3 py-3">{new Date(invoice.created * 1000).toLocaleDateString()}</td>
                            <td className="px-3 py-3">
                              {formatCurrency(invoice.amount_paid / 100, invoice.currency.toUpperCase())}
                            </td>
                            <td className="px-3 py-3 capitalize">{invoice.status}</td>
                            <td className="px-3 py-3">
                              {invoice.hosted_invoice_url ? (
                                <a
                                  href={invoice.hosted_invoice_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline underline-offset-4"
                                >
                                  View
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No invoices yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "integrations" ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Google Calendar</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">
                  Connect Google Calendar to push renewal events through OAuth.
                </p>
                <a
                  href={`https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}&redirect_uri=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/google-calendar/callback`)}&scope=${encodeURIComponent("https://www.googleapis.com/auth/calendar.events")}&access_type=offline&prompt=consent`}
                  className={cn(buttonVariants())}
                >
                  Connect
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slack</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                  Slack notifications are configured in the Notifications tab.
                </p>
                <Button variant="outline" onClick={() => setActiveTab("notifications")}>
                  Go to Slack settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Google Drive</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                  Coming soon
                </span>
                <p className="text-muted-foreground text-sm">
                  Store source agreements and extracted data closer to your document workflow.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "danger" ? (
          <div className="space-y-6">
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle>Export all data</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={exportAllData}>
                  Download CSV of all contracts
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle>Delete account</CardTitle>
                <CardDescription>
                  This permanently removes your account. Type your email to confirm deletion.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive">Delete account</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm account deletion</DialogTitle>
                      <DialogDescription>
                        Type {profile.email} to confirm this action.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} />
                      <Button
                        variant="destructive"
                        disabled={deleteEmail !== profile.email || deletingAccount}
                        onClick={deleteAccount}
                      >
                        {deletingAccount ? <Loader2 className="size-4 animate-spin" /> : null}
                        Permanently delete account
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
