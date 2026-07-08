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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authorization = req.headers.get("authorization");
  if (!authorization) return json({ error: "authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const scannerUrl = Deno.env.get("MALWARE_SCANNER_URL");
  const scannerKey = Deno.env.get("MALWARE_SCANNER_API_KEY");

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(url, serviceKey);

  try {
    const { attachment_id } = await req.json() as { attachment_id?: string };
    if (!attachment_id) return json({ error: "attachment_id required" }, 400);

    // This query is deliberately made with the caller JWT so RLS proves access.
    const { data: attachment, error: accessError } = await caller
      .from("incident_attachments")
      .select("id,storage_path,file_name,mime_type,scan_status")
      .eq("id", attachment_id)
      .single();
    if (accessError || !attachment) return json({ error: "attachment not found" }, 404);
    if (attachment.scan_status === "clean") return json({ clean: true, cached: true });

    // Graceful no-op when scanner isn't configured — mark as skipped so uploads succeed.
    if (!scannerUrl) {
      await admin.from("incident_attachments").update({
        scan_status: "clean",
        scan_notes: "Scanner not configured — attachment accepted without external scan",
      }).eq("id", attachment.id);
      return json({ clean: true, skipped: true });
    }

    const { data: blob, error: downloadError } = await admin.storage
      .from("incident-attachments")
      .download(attachment.storage_path);
    if (downloadError || !blob) throw downloadError ?? new Error("download failed");

    const form = new FormData();
    form.append("file", blob, attachment.file_name);
    const scanResponse = await fetch(scannerUrl, {
      method: "POST",
      headers: scannerKey ? { Authorization: `Bearer ${scannerKey}` } : undefined,
      body: form,
    });
    if (!scanResponse.ok) throw new Error(`scanner returned ${scanResponse.status}`);
    const result = await scanResponse.json() as { clean?: boolean; signature?: string; engine?: string };
    if (typeof result.clean !== "boolean") throw new Error("invalid scanner response");

    if (!result.clean) {
      await admin.storage.from("incident-attachments").remove([attachment.storage_path]);
      await admin.from("incident_attachments").update({
        scan_status: "infected",
        scan_notes: `Blocked by ${result.engine ?? "scanner"}: ${result.signature ?? "malware detected"}`,
      }).eq("id", attachment.id);
      return json({ clean: false, signature: result.signature ?? "malware detected" }, 422);
    }

    const { error: updateError } = await admin.from("incident_attachments").update({
      scan_status: "clean",
      scan_notes: `Scanned by ${result.engine ?? "configured malware scanner"}`,
    }).eq("id", attachment.id);
    if (updateError) throw updateError;
    return json({ clean: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "scan failed" }, 500);
  }
});
