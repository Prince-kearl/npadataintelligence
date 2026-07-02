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
  user_id: string;
  action: "resend_invite" | "force_password_reset";
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
    if (!body.user_id || !body.action) {
      return json({ error: "user_id and action are required" }, 400);
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

    if (!isAllowed || !activeData) return json({ error: "active administrator required" }, 403);

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.user_id);
    if (targetError || !target.user || !target.user.email) {
      return json({ error: targetError?.message || "target user not found" }, 404);
    }

    if (body.action === "resend_invite") {
      const invited = await admin.auth.admin.inviteUserByEmail(target.user.email);
      if (invited.error) return json({ error: invited.error.message }, 400);

      await admin.from("notifications").insert({
        user_id: target.user.id,
        title: "Invitation resent",
        message: "An administrator resent your invitation email.",
        category: "account",
        metadata: { action: "resend_invite" },
      });

      return json({ ok: true, action: body.action });
    }

    const reset = await admin.auth.resetPasswordForEmail(target.user.email);
    if (reset.error) return json({ error: reset.error.message }, 400);

    await admin.from("notifications").insert({
      user_id: target.user.id,
      title: "Password reset required",
      message: "An administrator requested a password reset for your account. Check your inbox.",
      category: "account",
      metadata: { action: "force_password_reset" },
    });

    return json({ ok: true, action: body.action });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "request failed" }, 500);
  }
});
