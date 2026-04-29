import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
});

function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success || parsed.data.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return NextResponse.json({ error: "Email verification failed" }, { status: 400 });
  }

  const service = createServiceClient();

  await service.from("organization_members").delete().eq("profile_id", user.id);
  await service.from("organization_invitations").delete().eq("invited_by", user.id);
  await service.from("profiles").delete().eq("id", user.id);
  await service.from("organizations").delete().eq("owner_id", user.id);

  const { error } = await service.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
