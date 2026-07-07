import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Payload {
  email: string;
  full_name?: string | null;
  department?: string | null;
  role: "collector" | "analyst" | "admin";
  status: "pending" | "active" | "suspended";
  redirect_to?: string | null;
}

const DEFAULT_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://npadataintelligence.vercel.app";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authorization = req.headers.get("authorization");
  if (!authorization) return json({ error: "authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(url, service);

  try {
    const body = (await req.json()) as Payload;
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.role || !body.status) {
      return json({ error: "email, role and status are required" }, 400);
    }

    const { data: meData, error: meError } = await caller.auth.getUser();
    if (meError || !meData.user) return json({ error: "invalid authentication" }, 401);

    const { data: isAllowed, error: roleError } = await admin.rpc("has_role", {
      _user_id: meData.user.id,
      _role: "admin",
    });
    if (roleError) return json({ error: roleError.message }, 500);

    const { data: activeData, error: activeError } = await admin.rpc("is_active_user", {
      _user_id: meData.user.id,
    });
    if (activeError) return json({ error: activeError.message }, 500);

    if (!isAllowed || !activeData) {
      return json({ error: "active administrator required" }, 403);
    }

    const redirectTo = (body.redirect_to && /^https?:\/\//i.test(body.redirect_to))
      ? body.redirect_to
      : `${DEFAULT_SITE_URL.replace(/\/$/, "")}/login`;

    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: body.full_name ?? email,
        department: body.department ?? "",
      },
      redirectTo,
    });
    if (invited.error || !invited.data.user) {
      return json({ error: invited.error?.message || "invite failed" }, 400);
    }

    const userId = invited.data.user.id;

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: body.full_name ?? email,
        department: body.department ?? null,
        status: body.status,
      })
      .eq("id", userId);
    if (profileError) return json({ error: profileError.message }, 500);

    const { error: roleDeleteError } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (roleDeleteError) return json({ error: roleDeleteError.message }, 500);

    const { error: roleInsertError } = await admin.from("user_roles").insert({
      user_id: userId,
      role: body.role,
    });
    if (roleInsertError) return json({ error: roleInsertError.message }, 500);

    const { error: notificationError } = await admin.from("notifications").insert({
      user_id: userId,
      title: "Account invitation created",
      message: "You were invited to the Consumer Data Intelligence System. Complete sign-in to activate your access.",
      category: "account",
      metadata: { role: body.role, status: body.status },
    });
    if (notificationError) return json({ error: notificationError.message }, 500);

    return json({ ok: true, user_id: userId, email });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "invite failed" }, 500);
  }
});
