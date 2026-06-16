/**
 * Offline-capable draft storage for incident reports.
 * Uses IndexedDB (idb-keyval) so drafts survive reloads and offline periods.
 */
import { get, set, del, keys } from "idb-keyval";

const PREFIX = "npa-draft-";

export interface IncidentDraft {
  id: string;
  updatedAt: number;
  payload: Record<string, unknown>;
}

export async function saveDraft(id: string, payload: Record<string, unknown>) {
  const draft: IncidentDraft = { id, updatedAt: Date.now(), payload };
  await set(PREFIX + id, draft);
}

export async function loadDraft(id: string): Promise<IncidentDraft | undefined> {
  return (await get(PREFIX + id)) as IncidentDraft | undefined;
}

export async function deleteDraft(id: string) {
  await del(PREFIX + id);
}

export async function listDrafts(): Promise<IncidentDraft[]> {
  const allKeys = await keys();
  const drafts: IncidentDraft[] = [];
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const d = (await get(k)) as IncidentDraft | undefined;
      if (d) drafts.push(d);
    }
  }
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}
