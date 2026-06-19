import type { IncidentRow } from "./incidents";

function csvEscape(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Prevent spreadsheet applications from interpreting untrusted cells as formulae.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EXPORT_COLUMNS: (keyof IncidentRow)[] = [
  "reference_code",
  "incident_date",
  "region",
  "district",
  "location_name",
  "gps_coordinates",
  "category",
  "incident_type",
  "description",
  "product_type",
  "injury_type",
  "casualties",
  "fatalities",
  "reporter_name",
  "department",
  "source",
  "status",
  "created_at",
  "updated_at",
];

export function incidentsToCSV(rows: IncidentRow[]): string {
  if (!rows.length) return EXPORT_COLUMNS.join(",");
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(EXPORT_COLUMNS.map((h) => csvEscape((r as any)[h])).join(","));
  }
  return lines.join("\n");
}

function sqlEscape(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function incidentsToSQLDump(rows: IncidentRow[]): string {
  const header = `-- NPA Incident & Field Data Intelligence System
-- SQL Dump generated ${new Date().toISOString()}
-- Records: ${rows.length}

DROP TABLE IF EXISTS incidents;
CREATE TABLE incidents (
  reference_code VARCHAR(32) PRIMARY KEY,
  incident_date DATE NOT NULL,
  region VARCHAR(64),
  district VARCHAR(64),
  location_name VARCHAR(255),
  gps_coordinates VARCHAR(64),
  category VARCHAR(64),
  incident_type VARCHAR(32),
  description TEXT,
  product_type VARCHAR(64),
  injury_type VARCHAR(64),
  casualties INTEGER DEFAULT 0,
  fatalities INTEGER DEFAULT 0,
  reporter_name VARCHAR(128),
  department VARCHAR(128),
  source VARCHAR(64),
  status VARCHAR(32),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

`;
  const inserts = rows
    .map(
      (r) =>
        `INSERT INTO incidents (${EXPORT_COLUMNS.join(", ")}) VALUES (${EXPORT_COLUMNS.map(
          (c) => sqlEscape((r as any)[c])
        ).join(", ")});`
    )
    .join("\n");
  return header + inserts + "\n";
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function timestampedName(base: string, ext: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}_${ts}.${ext}`;
}
