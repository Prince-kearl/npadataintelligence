/**
 * Hierarchical Year → Quarter → Month filter shared by every analytics card.
 * State is intentionally local per card (no global sync) so users can compare
 * different timeframes side-by-side.
 */

export interface ChartTimeFilterState {
  year: number | null;
  quarter: 1 | 2 | 3 | 4 | null;
  month: number | null; // 1-12, must belong to selected quarter
}

export const DEFAULT_CHART_TIME_FILTER: ChartTimeFilterState = {
  year: null,
  quarter: null,
  month: null,
};

export const CHART_YEARS = [2023, 2024, 2025, 2026] as const;

export const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function filterByChartTime<T extends { incident_date: string }>(
  rows: T[],
  state: ChartTimeFilterState,
): T[] {
  if (!state.year) return rows;
  return rows.filter((r) => {
    const d = r.incident_date;
    if (!d) return false;
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7));
    if (y !== state.year) return false;
    if (state.quarter) {
      if (!QUARTER_MONTHS[state.quarter].includes(m)) return false;
      if (state.month && m !== state.month) return false;
    }
    return true;
  });
}

export function chartTimeLabel(state: ChartTimeFilterState, fallback = "All time"): string {
  if (!state.year) return fallback;
  if (!state.quarter) return `${state.year}`;
  if (!state.month) return `Q${state.quarter} ${state.year}`;
  return `${MONTH_LABELS[state.month - 1]} ${state.year}`;
}

/** Granularity a chart should render at, given the filter state. */
export type ChartGranularity = "monthly" | "monthly-quarter" | "daily";

export function chartGranularity(state: ChartTimeFilterState): ChartGranularity {
  if (state.month) return "daily";
  if (state.quarter) return "monthly-quarter";
  return "monthly";
}

/**
 * Build a trend series that adapts to the filter granularity.
 *  - No filter / year only  -> 12 months of the year (or last 6 rolling if no year)
 *  - Quarter                -> 3 months of that quarter
 *  - Month                  -> daily breakdown of that month
 */
export function trendSeries<T extends { incident_date: string }>(
  rows: T[],
  state: ChartTimeFilterState,
): { label: string; incidents: number }[] {
  if (state.month && state.year && state.quarter) {
    const daysInMonth = new Date(state.year, state.month, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({
      label: String(i + 1).padStart(2, "0"),
      incidents: 0,
    }));
    for (const r of rows) {
      const day = Number(r.incident_date.slice(8, 10));
      if (day >= 1 && day <= daysInMonth) buckets[day - 1].incidents += 1;
    }
    return buckets;
  }
  if (state.quarter && state.year) {
    return QUARTER_MONTHS[state.quarter].map((m) => {
      const key = `${state.year}-${String(m).padStart(2, "0")}`;
      return {
        label: MONTH_LABELS[m - 1],
        incidents: rows.filter((r) => r.incident_date.slice(0, 7) === key).length,
      };
    });
  }
  if (state.year) {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const key = `${state.year}-${String(m).padStart(2, "0")}`;
      return {
        label: MONTH_LABELS[i],
        incidents: rows.filter((r) => r.incident_date.slice(0, 7) === key).length,
      };
    });
  }
  // Rolling 6 months
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, offset) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - offset), 1));
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }),
      incidents: 0,
    };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const r of rows) {
    const b = byKey.get(r.incident_date.slice(0, 7));
    if (b) b.incidents += 1;
  }
  return buckets.map(({ label, incidents }) => ({ label, incidents }));
}
