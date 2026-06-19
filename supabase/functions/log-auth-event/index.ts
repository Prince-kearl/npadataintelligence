// Records authenticated session events. Identity is derived from the verified JWT;
// the caller cannot supply an email, user id, or arbitrary event name.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  event_type: "login_success" | "logout" | "password_reset";
  metadata?: Record<string, unknown>;
}

const allowedEvents = new Set(["login_success", "logout", "password_reset"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    if (!body?.event_type || !allowedEvents.has(body.event_type)) {
      return new Response(JSON.stringify({ error: "unsupported event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      null;
    const ua = req.headers.get("user-agent") || null;

    const authorization = req.headers.get("authorization");
    if (!authorization) {
      return new Response(JSON.stringify({ error: "authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: identity, error: identityError } = await admin.auth.getUser(token);
    if (identityError || !identity.user) {
      return new Response(JSON.stringify({ error: "invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await admin.from("auth_events").insert({
      user_id: identity.user.id,
      email: identity.user.email ?? null,
      event_type: body.event_type,
      ip_address: ip,
      user_agent: ua,
      metadata: body.metadata ?? null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
