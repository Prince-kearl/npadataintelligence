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

// Expanded range so historical archives and forward-looking projections both fit.
export const CHART_YEARS: readonly number[] = Array.from({ length: 2035 - 2015 + 1 }, (_, i) => 2035 - i);

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

/**
 * Consumer-reported incident sources. Distinguishes public/consumer channels
 * from internal (Field Inspection, NPA Patrol, Regulatory Audit, etc.).
 */
export const CONSUMER_REPORT_SOURCES: readonly string[] = [
  "Public Complaint",
  "Anonymous Tip",
  "Media / News Report",
];

export function isConsumerReport<T extends { source: string | null }>(row: T): boolean {
  return !!row.source && CONSUMER_REPORT_SOURCES.includes(row.source);
}

export function filterConsumerReports<T extends { source: string | null }>(rows: T[]): T[] {
  return rows.filter(isConsumerReport);
}

export interface EnhancedTrendPoint {
  label: string;
  incidents: number;
  pctChange: number | null; // vs previous bucket; null for first bucket or when prev = 0
  topCategory: string | null;
  topCategoryCount: number;
}

/**
 * Same time bucketing as trendSeries but also returns:
 *  - % change vs previous bucket
 *  - top incident category for the bucket
 */
export function enhancedTrendSeries<T extends { incident_date: string; category: string | null }>(
  rows: T[],
  state: ChartTimeFilterState,
): EnhancedTrendPoint[] {
  const base = trendSeries(rows, state);
  // Map each base bucket back to its date-key predicate to pick matching rows.
  const bucketRows: T[][] = base.map(() => []);
  const now = new Date();

  if (state.month && state.year && state.quarter) {
    const daysInMonth = new Date(state.year, state.month, 0).getDate();
    for (const r of rows) {
      const y = Number(r.incident_date.slice(0, 4));
      const m = Number(r.incident_date.slice(5, 7));
      const d = Number(r.incident_date.slice(8, 10));
      if (y === state.year && m === state.month && d >= 1 && d <= daysInMonth) {
        bucketRows[d - 1].push(r);
      }
    }
  } else if (state.quarter && state.year) {
    const months = QUARTER_MONTHS[state.quarter];
    for (const r of rows) {
      const y = Number(r.incident_date.slice(0, 4));
      const m = Number(r.incident_date.slice(5, 7));
      if (y !== state.year) continue;
      const idx = months.indexOf(m);
      if (idx >= 0) bucketRows[idx].push(r);
    }
  } else if (state.year) {
    for (const r of rows) {
      const y = Number(r.incident_date.slice(0, 4));
      const m = Number(r.incident_date.slice(5, 7));
      if (y === state.year && m >= 1 && m <= 12) bucketRows[m - 1].push(r);
    }
  } else {
    const keys = Array.from({ length: 6 }, (_, offset) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - offset), 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    });
    const idxByKey = new Map(keys.map((k, i) => [k, i]));
    for (const r of rows) {
      const idx = idxByKey.get(r.incident_date.slice(0, 7));
      if (idx !== undefined) bucketRows[idx].push(r);
    }
  }

  return base.map((b, i) => {
    const counts = new Map<string, number>();
    for (const r of bucketRows[i]) {
      const c = r.category?.trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let topCategory: string | null = null;
    let topCategoryCount = 0;
    for (const [c, n] of counts) {
      if (n > topCategoryCount) { topCategory = c; topCategoryCount = n; }
    }
    const prev = i > 0 ? base[i - 1].incidents : null;
    const pctChange =
      prev === null || prev === 0 ? null : ((b.incidents - prev) / prev) * 100;
    return {
      label: b.label,
      incidents: b.incidents,
      pctChange,
      topCategory,
      topCategoryCount,
    };
  });
}
