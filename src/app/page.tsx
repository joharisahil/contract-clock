import Link from "next/link";
import { Clock3, ArrowRight, Check, Sparkles, Shield, BarChart3, Users, CalendarDays, ChevronRight } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Track all contract types",
    description: "Monitor software, leases, vendors, insurance, retainers, memberships and more.",
    icon: Sparkles,
  },
  {
    title: "AI reads your PDFs",
    description: "Upload a contract and let AI extract vendor, renewal and notice dates.",
    icon: Check,
  },
  {
    title: "Reminders before renewal",
    description: "Stay ahead with 90, 60, 30 and 7 day reminders when it matters.",
    icon: CalendarDays,
  },
  {
    title: "Spend analytics",
    description: "See annual committed spend, category breakdowns and renewal exposure.",
    icon: BarChart3,
  },
  {
    title: "Team and client management",
    description: "Assign owners, collaborate with your team and manage multiple workspaces.",
    icon: Users,
  },
  {
    title: "Slack and calendar integrations",
    description: "Push reminders where your team already works and keep renewal dates visible.",
    icon: Shield,
  },
];

const faqs = [
  ["What counts as a contract?", "Any agreement with a renewal date or notice window: software subscriptions, leases, retainers, insurance, memberships, and vendor services."],
  ["Is my data secure?", "Yes. ContractClock is built on Supabase auth and storage, with scoped access to each organization’s data."],
  ["Do I need a credit card to try it?", "No. You can start free without a card and upgrade only when you need more capacity."],
  ["What happens after my trial ends?", "Paid plans continue automatically if you upgrade. If you do nothing, your account returns to the free tier."],
  ["Can I use this for multiple clients?", "Yes. Agency and Pro workflows are designed to support multiple clients and shared teams."],
  ["What types of reminders do you send?", "You can use email reminders, Slack notifications, and calendar-based renewal tracking."],
  ["Can I export my data?", "Yes. You can export contracts and billing data from the app when you need it."],
  ["Do you offer refunds?", "Billing support can help with plan changes and cancellation questions. Reach out if you need a review."],
];

const plans = [
  {
    name: "Free",
    price: "$0",
    limit: "3 contracts",
    features: ["Core dashboard", "Manual tracking", "Basic reminders"],
    cta: "Start free",
  },
  {
    name: "Starter",
    price: "$19",
    limit: "25 contracts",
    features: ["Email reminders", "PDF upload", "Simple analytics"],
    cta: "Choose Starter",
  },
  {
    name: "Pro",
    price: "$49",
    limit: "100 contracts",
    features: ["Team collaboration", "Slack integration", "Owner filters"],
    cta: "Choose Pro",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$99",
    limit: "Unlimited contracts",
    features: ["Unlimited tracking", "Advanced reporting", "Priority workflows"],
    cta: "Choose Business",
  },
  {
    name: "Agency",
    price: "$199",
    limit: "Unlimited contracts",
    features: ["Client workspaces", "Team controls", "Portfolio scale"],
    cta: "Choose Agency",
  },
];

export default function HomePage() {
  return (
    <div className="bg-[radial-gradient(circle_at_top_left,_rgba(17,24,39,0.08),_transparent_35%),linear-gradient(180deg,_#fcfaf7_0%,_#fff_40%,_#f7f4ef_100%)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-2xl shadow-sm">
              <Clock3 className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">ContractClock</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className={buttonVariants()}>
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <p className="mb-5 inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
              For small businesses, agencies and bookkeepers
            </p>
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight sm:text-6xl">
              Stop losing money to contracts you forgot about
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Track every vendor contract, software subscription, lease and business agreement. Get reminded before they auto-renew — before it costs you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={buttonVariants()}>
                Start free - no card required
              </Link>
              <a href="#features" className={buttonVariants({ variant: "outline" })}>
                See how it works
              </a>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Trusted by 1,200 businesses across UK, US and Canada
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-200/60 via-white to-stone-200 blur-3xl" />
            <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white p-3 shadow-2xl">
              <div className="rounded-[1.5rem] border border-black/5 bg-[#f8f6f2] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Dashboard preview</p>
                    <p className="text-2xl font-semibold">Your renewals at a glance</p>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Live screenshot placeholder
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Annual spend</p>
                    <p className="mt-2 text-3xl font-semibold">£127,400</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Renewing soon</p>
                    <p className="mt-2 text-3xl font-semibold">14 contracts</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Urgent renewals</p>
                    <p className="text-sm text-muted-foreground">Next 60 days</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {["Notion", "Google Workspace", "Office Lease"].map((item) => (
                      <div key={item} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                        <span>{item}</span>
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Action needed</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="problem">
          <h2 className="text-3xl font-semibold tracking-tight">Sound familiar?</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "We got charged £2,400 for a tool nobody uses — it auto-renewed 6 months ago",
              "Our office lease renewed for 3 years. We had 60 days to cancel. Nobody knew.",
              "I manage 15 clients and track their contracts in a spreadsheet I'm terrified of losing",
            ].map((copy) => (
              <Card key={copy} className="border-black/5 bg-white/90 shadow-sm">
                <CardContent className="p-6 text-base leading-7 text-muted-foreground">
                  {copy}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="features">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">Everything in one place</h2>
            <p className="mt-4 text-muted-foreground">
              ContractClock is built to keep renewal risk visible, actionable, and easy to delegate.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-black/5 bg-white/90 shadow-sm">
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-900">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="pricing">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
              <p className="mt-3 text-muted-foreground">
                Simple plans that grow with your contract portfolio.
              </p>
            </div>
            <div className="inline-flex rounded-full border bg-white p-1 text-sm font-medium shadow-sm">
              <button type="button" className="rounded-full bg-primary px-4 py-2 text-primary-foreground">Monthly</button>
              <button type="button" className="rounded-full px-4 py-2 text-muted-foreground">Yearly</button>
            </div>
          </div>
          <div className="mt-8 grid gap-4 xl:grid-cols-5">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative border-black/5 bg-white/90 shadow-sm",
                  plan.highlighted ? "ring-2 ring-primary" : "",
                )}
              >
                {plan.highlighted ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </div>
                ) : null}
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between gap-2">
                    <span>{plan.name}</span>
                    <span className="text-3xl">{plan.price}</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.limit}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-1 size-4 text-emerald-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className={cn(buttonVariants({ variant: plan.highlighted ? "default" : "outline" }), "w-full")}>
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            14-day free trial on all paid plans. No credit card required.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="faq">
          <h2 className="text-3xl font-semibold tracking-tight">FAQ</h2>
          <div className="mt-8 rounded-3xl border border-black/5 bg-white/90 p-2 shadow-sm">
            <Accordion>
              {faqs.map(([question, answer], index) => (
                <AccordionItem key={question} value={`faq-${index}`}>
                  <AccordionTrigger value={`faq-${index}`}>{question}</AccordionTrigger>
                  <AccordionContent value={`faq-${index}`}>{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-black/5 bg-primary px-6 py-12 text-primary-foreground shadow-2xl sm:px-10">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary-foreground/80">
              Start tracking for free today
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">3 contracts free forever. No credit card required.</h2>
            <div className="mt-8">
              <Link href="/signup" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "bg-white text-primary hover:bg-white/90")}>
                Create free account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
                <Clock3 className="size-4" />
              </div>
              <span className="font-semibold">ContractClock</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Never miss a renewal again.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
          <p className="text-sm text-muted-foreground">Made with love from India</p>
        </div>
      </footer>
    </div>
  );
}
