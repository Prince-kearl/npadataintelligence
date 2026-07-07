import { strToU8, zipSync } from "fflate";
import type { IncidentRow } from "./incidents";

export const EXPORT_COLUMNS = [
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
] as const satisfies readonly (keyof IncidentRow)[];

type ExportColumn = (typeof EXPORT_COLUMNS)[number];

const COLUMN_LABELS: Record<ExportColumn, string> = {
  reference_code: "Reference",
  incident_date: "Incident Date",
  region: "Region",
  district: "District",
  location_name: "Location",
  gps_coordinates: "GPS Coordinates",
  category: "Category",
  incident_type: "Incident Type",
  description: "Description",
  product_type: "Product",
  injury_type: "Injury Type",
  casualties: "Casualties",
  fatalities: "Fatalities",
  reporter_name: "Reporter",
  department: "Department",
  source: "Source",
  status: "Status",
  created_at: "Created At",
  updated_at: "Updated At",
};

function csvEscape(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet applications from interpreting untrusted cells as formulae.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function xmlEscape(value: unknown): string {
  const withoutControlCharacters = Array.from(String(value ?? ""), (character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13 ? "" : character;
  }).join("");
  return withoutControlCharacters
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function incidentsToCSV(rows: IncidentRow[]): string {
  const lines = [EXPORT_COLUMNS.map((column) => COLUMN_LABELS[column]).join(",")];
  for (const row of rows) lines.push(EXPORT_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  return lines.join("\r\n");
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const safe = String(value).split("\0").join("").replace(/'/g, "''");
  return `'${safe}'`;
}

export function incidentsToSQLDump(rows: IncidentRow[], generatedAt = new Date()): string {
  const quotedColumns = EXPORT_COLUMNS.map((column) => `"${column}"`).join(", ");
  const inserts = rows.map((row) =>
    `INSERT INTO "npa_incident_import" (${quotedColumns}) VALUES (${EXPORT_COLUMNS.map((column) => sqlLiteral(row[column])).join(", ")}) ON CONFLICT ("reference_code") DO NOTHING;`
  ).join("\n");

  return `-- Consumer Data Intelligence System
-- Portable, non-destructive SQL export generated ${generatedAt.toISOString()}
-- Records: ${rows.length}
-- Imports into a dedicated staging table; it never drops or overwrites production tables.

SET statement_timeout = '60s';
SET lock_timeout = '5s';
SET standard_conforming_strings = on;
BEGIN;

CREATE TABLE IF NOT EXISTS "npa_incident_import" (
  "reference_code" text PRIMARY KEY,
  "incident_date" date NOT NULL,
  "region" text,
  "district" text,
  "location_name" text,
  "gps_coordinates" text,
  "category" text,
  "incident_type" text,
  "description" text,
  "product_type" text,
  "injury_type" text,
  "casualties" integer DEFAULT 0 CHECK ("casualties" >= 0),
  "fatalities" integer DEFAULT 0 CHECK ("fatalities" >= 0),
  "reporter_name" text,
  "department" text,
  "source" text,
  "status" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

${inserts}

COMMIT;
`;
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function xlsxCell(reference: string, value: unknown, style = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

export function incidentsToXLSX(rows: IncidentRow[]): Blob {
  const header = `<row r="1">${EXPORT_COLUMNS.map((column, index) => xlsxCell(`${columnName(index)}1`, COLUMN_LABELS[column], 1)).join("")}</row>`;
  const body = rows.map((row, rowIndex) => {
    const number = rowIndex + 2;
    return `<row r="${number}">${EXPORT_COLUMNS.map((column, columnIndex) => xlsxCell(`${columnName(columnIndex)}${number}`, row[column])).join("")}</row>`;
  }).join("");
  const lastColumn = columnName(EXPORT_COLUMNS.length - 1);
  const widths = EXPORT_COLUMNS.map((column, index) => {
    const width = column === "description" ? 50 : ["location_name", "reporter_name"].includes(column) ? 24 : 16;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Consumer Data Intelligence — Incident Export</dc:title><dc:creator>National Petroleum Authority</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Consumer Data Intelligence System</Application></Properties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Incidents" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B2F6B"/><bgColor indexed="64"/></patternFill></fill><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${rows.length + 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${header}${body}</sheetData><autoFilter ref="A1:${lastColumn}${rows.length + 1}"/></worksheet>`),
  };
  const bytes = zipSync(files, { level: 6 });
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function incidentsToPDF(rows: IncidentRow[], generatedAt = new Date()): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const document = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  document.setProperties({ title: "Consumer Data Intelligence — Incident Summary Report", author: "National Petroleum Authority", subject: "Incident export" });
  document.setFontSize(18);
  document.setTextColor(27, 47, 107);
  document.text("Consumer Data Intelligence — Incident Summary Report", 36, 40);
  document.setFontSize(9);
  document.setTextColor(90, 100, 120);
  document.text(`Generated ${generatedAt.toLocaleString("en-GH")} · ${rows.length} record${rows.length === 1 ? "" : "s"}`, 36, 57);
  autoTable(document, {
    startY: 72,
    head: [["Reference", "Date", "Region", "District", "Location", "Category", "Status"]],
    body: rows.map((row) => [row.reference_code ?? "", row.incident_date, row.region, row.district ?? "", row.location_name, row.category, row.status]),
    styles: { fontSize: 7, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [27, 47, 107], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 88 }, 1: { cellWidth: 62 }, 2: { cellWidth: 75 }, 3: { cellWidth: 75 }, 4: { cellWidth: 130 } },
    didDrawPage: ({ pageNumber }) => {
      document.setFontSize(7);
      document.setTextColor(120);
      document.text(`Consumer Data Intelligence System · Page ${pageNumber}`, 36, document.internal.pageSize.height - 18);
    },
  });
  return document.output("blob");
}

export function downloadBlob(filename: string, content: BlobPart | Blob, mime?: string): Blob {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return blob;
}

export function timestampedName(base: string, ext: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}_${timestamp}.${ext}`;
}
