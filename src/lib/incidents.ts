import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type IncidentRow = Database["public"]["Tables"]["incidents"]["Row"];
export type IncidentStatus = Database["public"]["Enums"]["incident_status"];
export type IncidentSeverity = Database["public"]["Enums"]["incident_severity"];
export type AttachmentRow = Database["public"]["Tables"]["incident_attachments"]["Row"];
export type ResponseActionType = Database["public"]["Enums"]["response_action_type"];
export type ResponseActionRow = Database["public"]["Tables"]["incident_response_actions"]["Row"];
export type StatusHistoryRow = Database["public"]["Tables"]["incident_status_history"]["Row"];

/** Full lifecycle (new values) + legacy values kept for backward compat. */
export const LIFECYCLE_STATUSES: IncidentStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "returned",
  "verified",
  "Closed",
  "archived",
];

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  returned: "Returned for Clarification",
  verified: "Verified",
  archived: "Archived",
  // legacy / closed
  New: "New",
  Reviewed: "Reviewed",
  Closed: "Closed",
};

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export interface AttachmentMeta {
  path: string;
  name: string;
  size: number;
  type: string;
  tags?: string[];
  version?: number;
}

let incidentSchemaMode: "unknown" | "hardened" | "legacy" = "unknown";

function isMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return value.code === "42703" && Boolean(value.message?.includes(column));
}

async function listLegacyIncidents(): Promise<IncidentRow[]> {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .is("deleted_at", null)
    .order("incident_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listIncidents(): Promise<IncidentRow[]> {
  // The current Lovable-hosted database predates the recoverable-submission
  // migration. Keep read-only views operational until that migration is applied.
  if (incidentSchemaMode === "legacy") return listLegacyIncidents();

  const { data, error } = await (supabase
    .from("incidents")
    .select("*")
    .is("deleted_at", null) as any)
    .eq("submission_state", "complete")
    .order("incident_date", { ascending: false });
  if (error) {
    if (isMissingColumn(error, "submission_state")) {
      incidentSchemaMode = "legacy";
      return listLegacyIncidents();
    }
    throw error;
  }
  incidentSchemaMode = "hardened";
  return data ?? [];

}

export async function getIncident(id: string): Promise<IncidentRow | null> {
  const { data, error } = await supabase.from("incidents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateIncidentStatus(id: string, status: IncidentStatus, note?: string) {
  // Try the hardened RPC first; fall back to direct update on legacy schema.
  const { error } = await (supabase.rpc as any)("transition_incident_status", {
    _incident_id: id,
    _to_status: status,
    _note: note ?? null,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    // 42883 = function does not exist, PGRST202 = PostgREST couldn't find the RPC
    if (code === "42883" || code === "PGRST202") {
      const { error: updErr } = await supabase
        .from("incidents")
        .update({ status: status as any })
        .eq("id", id);
      if (updErr) throw updErr;
      return;
    }
    throw error;
  }
}

export async function createIncidentResponseAction(
  incidentId: string,
  action: ResponseActionType,
  instructions: string
): Promise<ResponseActionRow> {
  const { data, error } = await supabase.rpc("create_incident_response_action", {
    _incident_id: incidentId,
    _action: action,
    _instructions: instructions,
  });
  if (error) throw error;
  return data;
}

export async function listResponseActions(incidentId: string): Promise<ResponseActionRow[]> {
  const { data, error } = await supabase
    .from("incident_response_actions")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function legacyDirectInsert(payload: any): Promise<IncidentRow> {
  // Legacy schema path: insert directly into incidents.
  // Strip fields that don't exist on the legacy table.
  const { data: authData } = await supabase.auth.getUser();
  const reporterId = authData.user?.id ?? null;
  const insertRow: any = {
    reporter_id: reporterId,
    reporter_name: payload.reporter_name ?? null,
    department: payload.department ?? null,
    incident_date: payload.incident_date,
    region: payload.region,
    district: payload.district ?? null,
    location_name: payload.location_name,
    gps_coordinates: payload.gps_coordinates ?? null,
    category: payload.category,
    incident_type: payload.incident_type ?? null,
    severity: payload.severity ?? "medium",
    product_type: payload.product_type ?? null,
    injury_type: payload.injury_type ?? null,
    casualties: payload.casualties ?? 0,
    fatalities: payload.fatalities ?? 0,
    description: payload.description,
    source: payload.source ?? null,
    source_contact: payload.source_contact ?? null,
    source_notes: payload.source_notes ?? null,
    previous_channel: payload.previous_channel ?? null,
    verification_score: payload.verification_score ?? null,
    verification_notes: payload.verification_notes ?? null,
    status: "New" as any,
  };
  const { data, error } = await supabase
    .from("incidents")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) throw error;
  return data as IncidentRow;
}

export async function beginIncidentSubmission(
  submissionId: string,
  payload: Json,
  expectedAttachments: number
): Promise<IncidentRow> {
  const { data, error } = await (supabase.rpc as any)("begin_incident_submission", {
    _submission_id: submissionId,
    _payload: payload,
    _expected_attachments: expectedAttachments,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42883" || code === "PGRST202") {
      incidentSchemaMode = "legacy";
      return legacyDirectInsert(payload);
    }
    throw error;
  }
  return data as IncidentRow;
}

export async function finalizeIncidentSubmission(incidentId: string): Promise<IncidentRow> {
  const { data, error } = await (supabase.rpc as any)("finalize_incident_submission", {
    _incident_id: incidentId,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42883" || code === "PGRST202") {
      // Legacy schema — the incident is already "final" after insert.
      const existing = await getIncident(incidentId);
      if (!existing) throw new Error("Incident not found after submission");
      return existing;
    }
    throw error;
  }
  return data as IncidentRow;
}


// ============ Attachments (multi-file evidence) ============

const SAFE_MIME = /^(image\/(png|jpe?g|webp|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\..+|vnd\.ms-excel)|text\/(plain|csv))$/;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function validateAttachment(file: File): void {
  if (file.size === 0) throw new Error(`${file.name} is empty`);
  if (file.size > MAX_SIZE) throw new Error(`${file.name} exceeds 10MB`);
  if (!SAFE_MIME.test(file.type)) throw new Error(`${file.name} has unsupported MIME type ${file.type || "unknown"}`);
}

export async function uploadAttachment(userId: string, submissionId: string, index: number, file: File): Promise<AttachmentMeta> {
  validateAttachment(file);
  const path = `${userId}/${submissionId}/${index}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("incident-attachments").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function attachToIncident(
  incidentId: string,
  userId: string,
  file: File,
  meta: AttachmentMeta,
  tags: string[] = []
): Promise<AttachmentRow> {
  validateAttachment(file);
  const { data: alreadyRegistered, error: lookupError } = await supabase
    .from("incident_attachments")
    .select("*")
    .eq("storage_path", meta.path)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (alreadyRegistered) return alreadyRegistered;

  // Determine next version number for same filename within this incident
  const { data: existing } = await supabase
    .from("incident_attachments")
    .select("version")
    .eq("incident_id", incidentId)
    .eq("file_name", meta.name)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from("incident_attachments")
    .insert({
      incident_id: incidentId,
      storage_path: meta.path,
      file_name: meta.name,
      file_size: meta.size,
      mime_type: meta.type,
      tags,
      version: nextVersion,
      scan_status: "pending",
      scan_notes: null,
      uploaded_by: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function scanAttachment(attachmentId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("scan-attachment", {
    body: { attachment_id: attachmentId },
  });
  if (error) throw error;
  if (!data?.clean) throw new Error(data?.signature || "Attachment did not pass malware scanning");
}

export async function listAttachments(incidentId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("incident_attachments")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateAttachmentTags(id: string, tags: string[]) {
  const { error } = await supabase.from("incident_attachments").update({ tags }).eq("id", id);
  if (error) throw error;
}

export async function deleteAttachment(id: string, storagePath: string) {
  await supabase.storage.from("incident-attachments").remove([storagePath]);
  const { error } = await supabase.from("incident_attachments").delete().eq("id", id);
  if (error) throw error;
}

export async function getAttachmentSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from("incident-attachments")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// ============ Status history ============

export async function listStatusHistory(incidentId: string): Promise<StatusHistoryRow[]> {
  const { data, error } = await supabase
    .from("incident_status_history")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ============ Export history ============

export async function recordExport(input: {
  userId: string;
  userEmail: string | null;
  format: string;
  fileName: string;
  rowCount: number;
  fileSize: number;
  filters?: unknown;
}) {
  const { error } = await supabase.from("export_history").insert({
    user_id: input.userId,
    user_email: input.userEmail,
    format: input.format,
    file_name: input.fileName,
    row_count: input.rowCount,
    file_size_bytes: input.fileSize,
    filters: (input.filters ?? null) as any,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) throw error;
}

export async function listExportHistory(limit = 25) {
  const { data, error } = await supabase
    .from("export_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ============ Query templates ============

export interface QueryFilters {
  search?: string;
  status?: string;
  region?: string;
  district?: string;
  category?: string;
  product_type?: string;
  severity?: string;
  reporter?: string;
  date_from?: string;
  date_to?: string;
}

export interface IncidentUpdatePayload {
  location_name?: string;
  district?: string;
  gps_coordinates?: string;
  category?: string;
  incident_type?: string;
  severity?: IncidentSeverity;
  product_type?: string;
  injury_type?: string;
  casualties?: number;
  fatalities?: number;
  description?: string;
  source?: string;
  source_contact?: string;
  source_notes?: string;
  previous_channel?: string;
}

export async function listQueryTemplates() {
  const { data, error } = await supabase
    .from("query_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveQueryTemplate(input: {
  ownerId: string;
  name: string;
  description?: string;
  definition: QueryFilters;
  isShared?: boolean;
}) {
  const { data, error } = await supabase
    .from("query_templates")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      definition: input.definition as any,
      is_shared: !!input.isShared,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateQueryTemplate(input: {
  id: string;
  name: string;
  description?: string;
  definition: QueryFilters;
  isShared?: boolean;
}) {
  const { data, error } = await supabase.rpc("update_query_template", {
    _id: input.id,
    _name: input.name,
    _description: input.description ?? "",
    _definition: input.definition as unknown as Json,
    _is_shared: !!input.isShared,
  });
  if (error) throw error;
  return data;
}

export async function deleteQueryTemplate(id: string) {
  const { error } = await supabase.from("query_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function updateIncidentDetails(incidentId: string, payload: IncidentUpdatePayload): Promise<IncidentRow> {
  const { data, error } = await supabase.rpc("update_incident_details", {
    _incident_id: incidentId,
    _payload: payload as unknown as Json,
  });
  if (error) throw error;
  return data;
}

export async function deleteIncidentRecord(incidentId: string, reason?: string): Promise<IncidentRow> {
  const { data, error } = await supabase.rpc("delete_incident_record", {
    _incident_id: incidentId,
    _reason: reason ?? undefined,

  });
  if (error) throw error;
  return data;
}

export async function restoreIncidentRecord(incidentId: string, reason?: string): Promise<IncidentRow> {
  const { data, error } = await supabase.rpc("restore_incident_record", {
    _incident_id: incidentId,
    _reason: reason ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function listDeletedIncidents(limit = 100): Promise<IncidentRow[]> {
  const { data, error } = await supabase.rpc("list_deleted_incidents", {
    _limit: limit,
  });
  if (error) throw error;
  return data ?? [];
}

export async function adminSetAccountStatus(userId: string, status: Database["public"]["Enums"]["account_status"]) {
  const { data, error } = await supabase.rpc("admin_set_account_status", {
    _user_id: userId,
    _status: status,
  });
  if (error) throw error;
  return data;
}
