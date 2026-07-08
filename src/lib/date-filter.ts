import type { IncidentRow } from "./incidents";

export type DateRangeMode = "monthly" | "quarterly" | "yearly" | "all";

export const DATE_RANGE_LABELS: Record<DateRangeMode, string> = {
  monthly: "This month",
  quarterly: "This quarter",
  yearly: "This year",
  all: "All time",
};

/** Filter incidents by their incident_date against a rolling calendar window. */
export function filterIncidentsByRange<T extends { incident_date: string }>(
  rows: T[],
  mode: DateRangeMode,
  ref: Date = new Date()
): T[] {
  if (mode === "all") return rows;
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  let start: Date;
  if (mode === "monthly") start = new Date(Date.UTC(y, m, 1));
  else if (mode === "quarterly") start = new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
  else start = new Date(Date.UTC(y, 0, 1));
  const startISO = start.toISOString().slice(0, 10);
  return rows.filter((r) => r.incident_date >= startISO);
}

export function rangePeriodLabel(mode: DateRangeMode, ref: Date = new Date()): string {
  if (mode === "all") return "all time";
  if (mode === "yearly") return `${ref.getUTCFullYear()}`;
  if (mode === "quarterly") return `Q${Math.floor(ref.getUTCMonth() / 3) + 1} ${ref.getUTCFullYear()}`;
  return ref.toLocaleString(undefined, { month: "long", year: "numeric" });
}
