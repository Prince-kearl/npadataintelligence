import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { escapeHtml, incidentsToCSV, incidentsToPDF, incidentsToSQLDump, incidentsToXLSX } from "./exporters";
import type { IncidentRow } from "./incidents";

const row = {
  reference_code: "INC-TEST",
  incident_date: "2026-06-19",
  region: "Greater Accra",
  district: "Test",
  location_name: "=HYPERLINK(\"https://evil.test\")",
  gps_coordinates: null,
  category: "Spill",
  incident_type: "Minor",
  description: "O'Brien, sample\nincident",
  product_type: "PMS",
  injury_type: "None",
  casualties: 0,
  fatalities: 0,
  reporter_name: "Tester",
  department: "QA",
  source: "Test",
  status: "submitted",
  created_at: "2026-06-19T00:00:00Z",
  updated_at: "2026-06-19T00:00:00Z",
} as IncidentRow;

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

describe("incident exports", () => {
  it("neutralizes spreadsheet formula cells and quotes CSV correctly", () => {
    const csv = incidentsToCSV([row]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"O\'Brien, sample\nincident"');
  });

  it("escapes apostrophes in SQL string literals", () => {
    const sql = incidentsToSQLDump([row], new Date("2026-06-20T00:00:00Z"));
    expect(sql).toContain("O''Brien");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("INSERT INTO incidents");
  });

  it("escapes untrusted HTML", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("creates a genuine XLSX OpenXML package with literal, non-formula cells", async () => {
    const blob = incidentsToXLSX([row]);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const archive = unzipSync(new Uint8Array(await readBlob(blob)));
    expect(Object.keys(archive)).toContain("xl/workbook.xml");
    expect(Object.keys(archive)).toContain("xl/worksheets/sheet1.xml");
    const sheet = strFromU8(archive["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("=HYPERLINK");
    expect(sheet).not.toContain("<f>");
  });

  it("creates a downloadable PDF binary", async () => {
    const blob = await incidentsToPDF([row], new Date("2026-06-20T00:00:00Z"));
    const signature = new TextDecoder().decode((await readBlob(blob)).slice(0, 5));
    expect(blob.type).toBe("application/pdf");
    expect(signature).toBe("%PDF-");
    expect(blob.size).toBeGreaterThan(1000);
  });
});
