import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CaseRow = Database["public"]["Tables"]["cases"]["Row"];
export type CaseStatus = Database["public"]["Enums"]["case_status"];

export const DEFAULT_DIRECTORATE = "SECURITY AND INTELLIGENCE";

export async function escalateIncident(input: {
  incidentId: string;
  hodEmail: string;
  hodName?: string;
  directorate?: string;
  notes?: string;
}): Promise<CaseRow> {
  const { data, error } = await supabase.rpc("escalate_incident", {
    _incident_id: input.incidentId,
    _hod_email: input.hodEmail,
    _hod_name: input.hodName ?? undefined,
    _directorate: input.directorate ?? DEFAULT_DIRECTORATE,
    _notes: input.notes ?? undefined,
  });
  if (error) throw error;
  return data as CaseRow;
}

export async function closeCase(caseId: string, resolution: string): Promise<CaseRow> {
  const { data, error } = await supabase.rpc("close_case", {
    _case_id: caseId,
    _resolution: resolution,
  });
  if (error) throw error;
  return data as CaseRow;
}

export async function markCaseEmailSent(
  caseId: string,
  status: "sent" | "failed" | "pending",
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase.rpc("mark_case_email_sent", {
    _case_id: caseId,
    _status: status,
    _error: errorMessage ?? undefined,
  });
  if (error) throw error;
}

export async function listCases(status?: CaseStatus): Promise<(CaseRow & { incident_reference: string | null })[]> {
  let query = supabase
    .from("cases")
    .select("*, incidents!inner(reference_code, category, region, location_name, incident_date)")
    .order("opened_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    incident_reference: row.incidents?.reference_code ?? null,
    incident_meta: row.incidents ?? null,
  }));
}

export function buildEscalationEmail(input: {
  caseId: string;
  incidentReference: string;
  incidentCategory: string;
  incidentLocation: string;
  incidentDate: string;
  incidentDescription: string;
  directorate: string;
  hodName?: string;
  senderName: string;
  senderEmail: string;
  notes?: string;
  incidentUrl: string;
}): { subject: string; body: string } {
  const subject = `[ESCALATION] ${input.incidentReference} — ${input.incidentCategory} · ${input.directorate}`;
  const greeting = input.hodName ? `Dear ${input.hodName},` : `Dear Head of ${input.directorate},`;
  const body = [
    greeting,
    "",
    `This incident has been escalated to the ${input.directorate} directorate for immediate attention.`,
    "",
    "INCIDENT DETAILS",
    `Reference: ${input.incidentReference}`,
    `Category: ${input.incidentCategory}`,
    `Location: ${input.incidentLocation}`,
    `Date: ${input.incidentDate}`,
    "",
    "DESCRIPTION",
    input.incidentDescription,
    "",
    input.notes ? "ESCALATION NOTES" : "",
    input.notes ? input.notes : "",
    input.notes ? "" : "",
    `Full case file: ${input.incidentUrl}`,
    "",
    "Regards,",
    input.senderName,
    input.senderEmail,
    "National Petroleum Authority — Consumer Data Intelligence System",
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
  return { subject, body };
}
