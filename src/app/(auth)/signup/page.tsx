"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Check,
  CircleAlert,
  Clock3,
  Loader2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const signupSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;
type SignupStep = "account" | "check-email" | "persona";

type PersonaOption = {
  value: string;
  label: string;
  icon: typeof BriefcaseBusiness;
};

const personas: PersonaOption[] = [
  {
    value: "bookkeeper_or_accountant",
    label: "Bookkeeper or Accountant",
    icon: ShieldCheck,
  },
  {
    value: "agency_or_consultancy_owner",
    label: "Agency or Consultancy Owner",
    icon: Building2,
  },
  {
    value: "operations_manager",
    label: "Operations Manager",
    icon: BriefcaseBusiness,
  },
  { value: "business_owner", label: "Business Owner", icon: UsersRound },
  {
    value: "freelancer_or_consultant",
    label: "Freelancer or Consultant",
    icon: UserRound,
  },
];

function getPasswordStrength(password: string) {
  if (password.length >= 12) {
    return { label: "Strong", width: "100%", className: "bg-emerald-500" };
  }

  if (password.length >= 8) {
    return { label: "Good", width: "66%", className: "bg-amber-500" };
  }

  if (password.length > 0) {
    return { label: "Weak", width: "33%", className: "bg-destructive" };
  }

  return {
    label: "Too short",
    width: "12%",
    className: "bg-muted-foreground/30",
  };
}

// For Google OAuth → goes to /auth/callback (code exchange)
function getOAuthRedirectUrl() {
  const origin = window.location.origin;
  const next = encodeURIComponent("/signup?step=persona");
  return `${origin}/auth/callback?next=${next}`;
}

// For email signup → goes to /auth/confirm (token_hash verification)
function getEmailConfirmRedirectUrl() {
  const origin = window.location.origin;
  return `${origin}/auth/confirm?next=${encodeURIComponent("/signup?step=persona")}`;
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<SignupStep>("account");
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isPersonaSubmitting, setIsPersonaSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isHydratingPersonaStep, setIsHydratingPersonaStep] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordStrength = getPasswordStrength(watch("password") ?? "");

  useEffect(() => {
    const stepParam = searchParams.get("step");

    if (stepParam !== "persona") {
      return;
    }

    let isMounted = true;

    const preparePersonaStep = async () => {
      setIsHydratingPersonaStep(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!user) {
        setStep("account");
        setIsHydratingPersonaStep(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("persona")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.persona) {
        router.replace("/dashboard?welcome=true");
        router.refresh();
        return;
      }

      setStep("persona");
      setIsHydratingPersonaStep(false);
    };

    void preparePersonaStep();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams, supabase]);

  const onSubmit = async (values: SignupFormValues) => {
    setAuthError(null);

    // AFTER (correct)
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: getEmailConfirmRedirectUrl(), // ✅ correct function
        data: { full_name: values.fullName },
      },
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setPendingEmail(values.email);
    setStep("check-email");
  };

  const handleGoogleSignup = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthRedirectUrl(),
      },
    });

    if (error) {
      setAuthError(error.message);
      setIsGoogleLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setAuthError(null);
    setIsResending(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: {
        emailRedirectTo: getEmailConfirmRedirectUrl(), // ✅ fix here too
      },
    });

    if (error) setAuthError(error.message);
    setIsResending(false);
  };

  const handlePersonaContinue = async () => {
    if (!selectedPersona) {
      setAuthError("Please choose the option that best describes you");
      return;
    }

    setAuthError(null);
    setIsPersonaSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAuthError("Your session expired. Please sign in again.");
      setIsPersonaSubmitting(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? "",
        full_name:
          (user.user_metadata.full_name as string | undefined) ??
          (user.user_metadata.name as string | undefined) ??
          null,
        role: "admin",
        timezone: "UTC",
        currency: "USD",
        persona: selectedPersona,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      setAuthError(error.message);
      setIsPersonaSubmitting(false);
      return;
    }

    router.replace("/dashboard?welcome=true");
    router.refresh();
  };

  if (isHydratingPersonaStep) {
    return (
      <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="text-muted-foreground flex items-center justify-center gap-3 p-8 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Preparing your workspace...
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-6">
          <div className="text-foreground flex items-center justify-center gap-2">
            <Clock3 className="size-5" />
            <span className="text-lg font-semibold">ContractClock</span>
          </div>
          {step === "persona" ? (
            <div className="space-y-2 text-center">
              <CardTitle>What best describes you?</CardTitle>
              <CardDescription>
                Pick the role that most closely matches how you&apos;ll use
                ContractClock.
              </CardDescription>
            </div>
          ) : step === "check-email" ? (
            <div className="space-y-2 text-center">
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                We&apos;ve sent a confirmation link to{" "}
                <span className="text-foreground font-medium">
                  {pendingEmail}
                </span>
                .
              </CardDescription>
            </div>
          ) : (
            <div className="space-y-2 text-center">
              <CardTitle>Create your free account</CardTitle>
              <CardDescription>
                Start tracking renewals, spend, and approvals in one place.
              </CardDescription>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "account" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignup}
                disabled={isSubmitting || isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card text-muted-foreground px-2">
                    Or create an account with email
                  </span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    placeholder="Alex Morgan"
                    autoComplete="name"
                    {...register("fullName")}
                  />
                  {errors.fullName ? (
                    <p className="text-destructive text-sm">
                      {errors.fullName.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p className="text-destructive text-sm">
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  <div className="space-y-2">
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full transition-all ${passwordStrength.className}`}
                        style={{ width: passwordStrength.width }}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Password strength: {passwordStrength.label}
                    </p>
                  </div>
                  {errors.password ? (
                    <p className="text-destructive text-sm">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword ? (
                    <p className="text-destructive text-sm">
                      {errors.confirmPassword.message}
                    </p>
                  ) : null}
                </div>

                {authError ? (
                  <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                    {authError}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || isGoogleLoading}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {isSubmitting ? "Creating account..." : "Create free account"}
                </Button>
              </form>

              <p className="text-muted-foreground text-center text-sm">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-foreground font-medium underline underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            </>
          ) : null}

          {step === "check-email" ? (
            <div className="space-y-4">
              <div className="bg-muted/50 text-muted-foreground rounded-lg border p-4 text-sm">
                Confirm your email address to finish creating your ContractClock
                workspace. Once confirmed, you&apos;ll be taken to persona
                selection.
              </div>

              {authError ? (
                <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                  {authError}
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isResending ? "Sending..." : "Resend confirmation email"}
              </Button>

              <p className="text-muted-foreground text-center text-sm">
                Already confirmed?{" "}
                <Link
                  href="/login"
                  className="text-foreground font-medium underline underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            </div>
          ) : null}

          {step === "persona" ? (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-2">
                {personas.map((persona) => {
                  const Icon = persona.icon;
                  const isSelected = selectedPersona === persona.value;

                  return (
                    <button
                      key={persona.value}
                      type="button"
                      onClick={() => setSelectedPersona(persona.value)}
                      className={`flex min-h-28 items-start justify-between rounded-xl border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <Icon className="size-5" />
                        </div>
                        <p className="font-medium">{persona.label}</p>
                      </div>
                      {isSelected ? (
                        <Check className="text-primary size-5" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {authError ? (
                <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full"
                onClick={handlePersonaContinue}
                disabled={isPersonaSubmitting}
              >
                {isPersonaSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isPersonaSubmitting ? "Saving..." : "Continue"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function SignupPageFallback() {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="text-muted-foreground flex items-center justify-center gap-3 p-8 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading signup...
        </CardContent>
      </Card>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageContent />
    </Suspense>
  );
}
