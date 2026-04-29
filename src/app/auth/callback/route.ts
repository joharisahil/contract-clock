import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", requestUrl.origin),
    );
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      email: data.user.email ?? "",
      full_name:
        (data.user.user_metadata.full_name as string | undefined) ??
        (data.user.user_metadata.name as string | undefined) ??
        null,
      role: "admin",
      timezone: "UTC",
      currency: "USD",
      persona: null,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      return NextResponse.redirect(
        new URL("/login?error=auth_failed", requestUrl.origin),
      );
    }

    return NextResponse.redirect(new URL("/onboarding", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
