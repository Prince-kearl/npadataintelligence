// Mock data for the application
export const REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Eastern", "Central",
  "Northern", "Upper East", "Upper West", "Volta", "Bono",
  "Bono East", "Ahafo", "Western North", "Oti", "Savannah", "North East"
] as const;

export const DISTRICTS = [
  "Accra Metropolitan", "Kumasi Metropolitan", "Sekondi-Takoradi", 
  "Tamale Metropolitan", "Cape Coast Metropolitan", "Tema Metropolitan",
  "Sunyani Municipal", "Ho Municipal", "Bolgatanga Municipal", "Wa Municipal"
] as const;

export const INCIDENT_CATEGORIES = [
  "Spill", "Explosion", "Fire", "Leakage", "Equipment Failure",
  "BRV Crash/Accident", "Storage Incident", "Pipeline Breach",
  "Illegal Activity", "Environmental Contamination", "Other"
] as const;

export const INCIDENT_TYPES = [
  "Major", "Minor", "Near Miss", "Observation"
] as const;

export const PRODUCT_TYPES = [
  "Petrol (PMS)", "Diesel (AGO)", "Kerosene (DPK)", "LPG",
  "Crude Oil", "Aviation Fuel", "Lubricants", "Bitumen", "Other"
] as const;

export const INJURY_TYPES = [
  "None", "Minor Injury", "Serious Injury", "Fatal", "Multiple Injuries"
] as const;

export const RECORD_STATUSES = ["New", "Reviewed", "Closed"] as const;

export interface Incident {
  id: string;
  incident_date: string;
  region: string;
  district: string;
  location_name: string;
  gps_coordinates: string;
  category: string;
  incident_type: string;
  description: string;
  product_type: string;
  injury_type: string;
  casualties: number;
  fatalities: number;
  reporter_name: string;
  department: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const mockIncidents: Incident[] = [
  {
    id: "INC-2026-001",
    incident_date: "2026-03-01",
    region: "Western",
    district: "Sekondi-Takoradi",
    location_name: "TOR Refinery Complex",
    gps_coordinates: "4.9340, -1.7137",
    category: "Spill",
    incident_type: "Major",
    description: "Significant crude oil spill detected at storage tank ST-14 during routine transfer operations. Approximately 2,500 liters released.",
    product_type: "Crude Oil",
    injury_type: "None",
    casualties: 0,
    fatalities: 0,
    reporter_name: "Kwame Asante",
    department: "Field Operations",
    status: "Reviewed",
    created_at: "2026-03-01T09:15:00Z",
    updated_at: "2026-03-02T14:30:00Z",
  },
  {
    id: "INC-2026-002",
    incident_date: "2026-03-03",
    region: "Greater Accra",
    district: "Tema Metropolitan",
    location_name: "Tema Oil Depot",
    gps_coordinates: "5.6315, -0.0167",
    category: "Fire",
    incident_type: "Major",
    description: "Fire outbreak at loading bay area during diesel transfer. Emergency response activated immediately.",
    product_type: "Diesel (AGO)",
    injury_type: "Serious Injury",
    casualties: 3,
    fatalities: 0,
    reporter_name: "Ama Mensah",
    department: "Safety & Compliance",
    status: "New",
    created_at: "2026-03-03T11:45:00Z",
    updated_at: "2026-03-03T11:45:00Z",
  },
  {
    id: "INC-2026-003",
    incident_date: "2026-03-05",
    region: "Ashanti",
    district: "Kumasi Metropolitan",
    location_name: "GOIL Kumasi Station",
    gps_coordinates: "6.6885, -1.6244",
    category: "Leakage",
    incident_type: "Minor",
    description: "Underground storage tank leak detected during routine inspection. Tank isolated and repair scheduled.",
    product_type: "Petrol (PMS)",
    injury_type: "None",
    casualties: 0,
    fatalities: 0,
    reporter_name: "Kofi Owusu",
    department: "Field Operations",
    status: "Closed",
    created_at: "2026-03-05T08:00:00Z",
    updated_at: "2026-03-07T16:00:00Z",
  },
  {
    id: "INC-2026-004",
    incident_date: "2026-03-06",
    region: "Northern",
    district: "Tamale Metropolitan",
    location_name: "Tamale LPG Depot",
    gps_coordinates: "9.4035, -0.8393",
    category: "Explosion",
    incident_type: "Major",
    description: "LPG cylinder explosion at distribution point. Multiple casualties reported. Area cordoned off.",
    product_type: "LPG",
    injury_type: "Fatal",
    casualties: 8,
    fatalities: 2,
    reporter_name: "Ibrahim Yakubu",
    department: "Field Operations",
    status: "New",
    created_at: "2026-03-06T14:20:00Z",
    updated_at: "2026-03-06T14:20:00Z",
  },
  {
    id: "INC-2026-005",
    incident_date: "2026-03-08",
    region: "Central",
    district: "Cape Coast Metropolitan",
    location_name: "Cape Coast Fuel Station",
    gps_coordinates: "5.1036, -1.2437",
    category: "Transportation Accident",
    incident_type: "Major",
    description: "Fuel tanker overturned on highway near Cape Coast. Road blocked, spill containment in progress.",
    product_type: "Petrol (PMS)",
    injury_type: "Minor Injury",
    casualties: 1,
    fatalities: 0,
    reporter_name: "Grace Appiah",
    department: "Transport Safety",
    status: "Reviewed",
    created_at: "2026-03-08T06:30:00Z",
    updated_at: "2026-03-09T10:00:00Z",
  },
  {
    id: "INC-2026-006",
    incident_date: "2026-03-09",
    region: "Volta",
    district: "Ho Municipal",
    location_name: "Ho Industrial Area",
    gps_coordinates: "6.6000, 0.4667",
    category: "Illegal Activity",
    incident_type: "Observation",
    description: "Suspected illegal fuel storage facility discovered during routine patrol. Reported to enforcement.",
    product_type: "Diesel (AGO)",
    injury_type: "None",
    casualties: 0,
    fatalities: 0,
    reporter_name: "Emmanuel Tetteh",
    department: "Enforcement",
    status: "New",
    created_at: "2026-03-09T15:00:00Z",
    updated_at: "2026-03-09T15:00:00Z",
  },
  {
    id: "INC-2026-007",
    incident_date: "2026-03-10",
    region: "Eastern",
    district: "Accra Metropolitan",
    location_name: "Koforidua Depot",
    gps_coordinates: "6.0833, -0.2500",
    category: "Equipment Failure",
    incident_type: "Near Miss",
    description: "Pressure relief valve malfunction on storage tank. Emergency shutdown activated. No release detected.",
    product_type: "Aviation Fuel",
    injury_type: "None",
    casualties: 0,
    fatalities: 0,
    reporter_name: "Samuel Boateng",
    department: "Maintenance",
    status: "Closed",
    created_at: "2026-03-10T10:45:00Z",
    updated_at: "2026-03-11T09:00:00Z",
  },
];

export const mockKPIs = {
  totalIncidents: 2104,
  totalCasualties: 347,
  totalFatalities: 23,
  activeCases: 89,
  closedCases: 2015,
};

export const mockMonthlyTrend = [
  { month: "Oct", incidents: 142 },
  { month: "Nov", incidents: 168 },
  { month: "Dec", incidents: 195 },
  { month: "Jan", incidents: 178 },
  { month: "Feb", incidents: 156 },
  { month: "Mar", incidents: 134 },
];

export const mockByRegion = [
  { region: "Greater Accra", incidents: 412 },
  { region: "Western", incidents: 387 },
  { region: "Ashanti", incidents: 298 },
  { region: "Northern", incidents: 245 },
  { region: "Eastern", incidents: 198 },
  { region: "Central", incidents: 176 },
  { region: "Volta", incidents: 145 },
  { region: "Others", incidents: 243 },
];

export const mockByType = [
  { name: "Spill", value: 534, fill: "hsl(220, 63%, 32%)" },
  { name: "Fire", value: 387, fill: "hsl(0, 84%, 60%)" },
  { name: "Leakage", value: 312, fill: "hsl(40, 90%, 44%)" },
  { name: "Explosion", value: 245, fill: "hsl(220, 65%, 17%)" },
  { name: "Equipment", value: 298, fill: "hsl(199, 89%, 48%)" },
  { name: "Transport", value: 189, fill: "hsl(142, 71%, 45%)" },
  { name: "Other", value: 139, fill: "hsl(220, 15%, 65%)" },
];

export const mockByProduct = [
  { product: "PMS", incidents: 612, severity: 4.2 },
  { product: "AGO", incidents: 489, severity: 3.8 },
  { product: "LPG", incidents: 378, severity: 5.1 },
  { product: "Crude", incidents: 267, severity: 4.7 },
  { product: "DPK", incidents: 198, severity: 3.2 },
  { product: "Aviation", incidents: 112, severity: 4.9 },
  { product: "Other", incidents: 48, severity: 2.1 },
];
