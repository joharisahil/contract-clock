"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Clock3, Loader2 } from "lucide-react";
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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const authErrorMessages: Record<string, string> = {
  invalid_credentials: "Incorrect email or password",
  email_not_confirmed: "Please check your email to confirm your account",
  too_many_requests: "Too many attempts. Please wait a moment.",
};

function getAuthErrorMessage(
  error: { code?: string; message?: string } | null,
) {
  if (!error) {
    return null;
  }

  return (
    authErrorMessages[error.code ?? ""] ??
    error.message ??
    "Unable to sign in right now"
  );
}

function isFirstLogin(createdAt?: string, lastSignInAt?: string) {
  if (!createdAt || !lastSignInAt) {
    return false;
  }

  return new Date(createdAt).getTime() === new Date(lastSignInAt).getTime();
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setAuthError(getAuthErrorMessage(error));
      return;
    }

    const nextPath = isFirstLogin(
      data.user?.created_at,
      data.user?.last_sign_in_at,
    )
      ? "/onboarding"
      : "/dashboard";

    router.replace(nextPath);
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);

    const redirectTo = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setAuthError(getAuthErrorMessage(error));
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-6">
          <div className="text-foreground flex items-center justify-center gap-2">
            <Clock3 className="size-5" />
            <span className="text-lg font-semibold">ContractClock</span>
          </div>
          <div className="space-y-2 text-center">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Access your contracts, reminders, and renewal timeline.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
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
                Or continue with email
              </span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground text-sm underline underline-offset-4"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-destructive text-sm">
                  {errors.password.message}
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
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Start free
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
