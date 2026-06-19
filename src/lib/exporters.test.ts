import { describe, expect, it } from "vitest";
import { escapeHtml, incidentsToCSV, incidentsToSQLDump } from "./exporters";
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

describe("incident exports", () => {
  it("neutralizes spreadsheet formula cells and quotes CSV correctly", () => {
    const csv = incidentsToCSV([row]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"O\'Brien, sample\nincident"');
  });

  it("escapes apostrophes in SQL string literals", () => {
    expect(incidentsToSQLDump([row])).toContain("O''Brien");
  });

  it("escapes untrusted HTML", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });
});
