import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type IncidentRow = Database["public"]["Tables"]["incidents"]["Row"];
export type IncidentInsert = Database["public"]["Tables"]["incidents"]["Insert"];
export type IncidentUpdate = Database["public"]["Tables"]["incidents"]["Update"];

export interface AttachmentMeta {
  path: string;
  name: string;
  size: number;
  type: string;
}

export async function listIncidents(): Promise<IncidentRow[]> {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .is("deleted_at", null)
    .order("incident_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getIncident(id: string): Promise<IncidentRow | null> {
  const { data, error } = await supabase.from("incidents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createIncident(payload: IncidentInsert): Promise<IncidentRow> {
  const { data, error } = await supabase.from("incidents").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateIncidentStatus(id: string, status: "New" | "Reviewed" | "Closed") {
  const { error } = await supabase.from("incidents").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function softDeleteIncident(id: string) {
  const { error } = await supabase
    .from("incidents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function uploadAttachment(userId: string, file: File): Promise<AttachmentMeta> {
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("incident-attachments").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function getAttachmentSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from("incident-attachments")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
