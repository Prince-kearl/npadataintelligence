/** Stable controlled-vocabulary options used by the incident submission form. */
export const REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Bono",
  "Bono East", "Ahafo", "Western North", "Oti", "Savannah", "North East",
] as const;

export const DISTRICTS = [
  "Accra Metropolitan", "Kumasi Metropolitan", "Sekondi-Takoradi",
  "Tamale Metropolitan", "Cape Coast Metropolitan", "Tema Metropolitan",
  "Sunyani Municipal", "Ho Municipal", "Bolgatanga Municipal", "Wa Municipal",
] as const;

export const INCIDENT_CATEGORIES = [
  "Spill", "Explosion", "Fire", "Leakage", "Equipment Failure",
  "BRV Crash/Accident", "Storage Incident", "Pipeline Breach",
  "Illegal Activity", "Environmental Contamination", "Other",
] as const;

export const INCIDENT_TYPES = ["Major", "Minor", "Near Miss", "Observation"] as const;

export const PRODUCT_TYPES = [
  "Petrol (PMS)", "Diesel (AGO)", "Kerosene (DPK)", "LPG",
  "Crude Oil", "Aviation Fuel", "Lubricants", "Bitumen", "Other",
] as const;

export const INJURY_TYPES = [
  "None", "Minor Injury", "Serious Injury", "Fatal", "Multiple Injuries",
] as const;

export const REPORT_SOURCES = [
  "Field Inspection",
  "Public Complaint",
  "Industry Operator Report",
  "Media / News Report",
  "Law Enforcement",
  "Internal NPA Patrol",
  "Anonymous Tip",
  "Regulatory Audit",
  "Other",
] as const;
