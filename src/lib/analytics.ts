import type { IncidentRow } from "./incidents";

export function monthlyTrend(rows: IncidentRow[], months = 6) {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - offset), 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      month: date.toLocaleString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }),
      incidents: 0,
    };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const row of rows) {
    const key = row.incident_date.slice(0, 7);
    const bucket = byKey.get(key);
    if (bucket) bucket.incidents += 1;
  }
  return buckets.map(({ key: _key, ...bucket }) => bucket);
}

export function incidentsByRegion(rows: IncidentRow[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.region, (counts.get(row.region) ?? 0) + 1));
  return [...counts].map(([region, incidents]) => ({ region, incidents })).sort((a, b) => b.incidents - a.incidents);
}

export function incidentsByCategory(rows: IncidentRow[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.category, (counts.get(row.category) ?? 0) + 1));
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function incidentsByProduct(rows: IncidentRow[]) {
  const groups = new Map<string, { incidents: number; casualties: number; fatalities: number }>();
  for (const row of rows) {
    const product = row.product_type || "Unspecified";
    const current = groups.get(product) ?? { incidents: 0, casualties: 0, fatalities: 0 };
    current.incidents += 1;
    current.casualties += row.casualties ?? 0;
    current.fatalities += row.fatalities ?? 0;
    groups.set(product, current);
  }
  return [...groups].map(([product, value]) => ({
    product,
    incidents: value.incidents,
    casualties: value.casualties,
    fatalities: value.fatalities,
  })).sort((a, b) => b.incidents - a.incidents);
}

