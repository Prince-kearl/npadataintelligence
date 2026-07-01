import { describe, expect, it } from "vitest";
import { findPotentialDuplicates } from "./incident-verification";
import type { IncidentRow } from "./incidents";

function incident(overrides: Partial<IncidentRow>): IncidentRow {
  return {
    id: crypto.randomUUID(),
    reference_code: "INC-TEST",
    incident_date: "2026-06-20",
    region: "Greater Accra",
    district: "Tema Metropolitan",
    location_name: "Tema Oil Depot",
    category: "Spill",
    description: "Diesel spill from a loading hose during transfer operations",
    gps_coordinates: "5.6315, -0.0167",
    previous_channel: null,
    ...overrides,
  } as IncidentRow;
}

describe("incident duplicate verification", () => {
  it("ranks a same-day nearby facility report as a potential duplicate", () => {
    const nearby = incident({ id: "nearby", reference_code: "INC-NEAR", gps_coordinates: "5.6316, -0.0167" });
    const matches = findPotentialDuplicates({
      incident_date: "2026-06-20",
      region: "Greater Accra",
      district: "Tema Metropolitan",
      location_name: "Tema Oil Depot",
      category: "Spill",
      description: "Diesel spill from loading hose during transfer",
      gps_coordinates: "5.6315, -0.0167",
    }, [nearby]);
    expect(matches[0]?.incident.id).toBe("nearby");
    expect(matches[0]?.score).toBeGreaterThanOrEqual(80);
  });

  it("excludes unrelated reports below the similarity threshold", () => {
    const unrelated = incident({
      incident_date: "2025-01-01",
      region: "Ashanti",
      district: "Kumasi Metropolitan",
      location_name: "Kumasi Station",
      category: "Equipment Failure",
      description: "Routine pressure gauge fault with no product release",
      gps_coordinates: "6.6885, -1.6244",
    });
    expect(findPotentialDuplicates({
      incident_date: "2026-06-20",
      region: "Greater Accra",
      district: "Tema Metropolitan",
      location_name: "Tema Oil Depot",
      category: "Spill",
      description: "Diesel spill from loading hose",
      gps_coordinates: "5.6315, -0.0167",
    }, [unrelated])).toEqual([]);
  });
});
