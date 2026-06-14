import { mockIncidents, type Incident } from "./mock-data";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function incidentsToCSV(rows: Incident[] = mockIncidents): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]) as (keyof Incident)[];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

function sqlEscape(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function incidentsToSQLDump(rows: Incident[] = mockIncidents): string {
  const header = `-- NPA Incident & Field Data Intelligence System
-- SQL Dump generated ${new Date().toISOString()}
-- Records: ${rows.length}

DROP TABLE IF EXISTS incidents;
CREATE TABLE incidents (
  id VARCHAR(32) PRIMARY KEY,
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
  status VARCHAR(32),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

`;
  const cols = [
    "id","incident_date","region","district","location_name","gps_coordinates",
    "category","incident_type","description","product_type","injury_type",
    "casualties","fatalities","reporter_name","department","status",
    "created_at","updated_at",
  ] as const;
  const inserts = rows
    .map(
      (r) =>
        `INSERT INTO incidents (${cols.join(", ")}) VALUES (${cols
          .map((c) => sqlEscape(r[c]))
          .join(", ")});`
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
