import type { IncidentRow } from "./incidents";

export interface CandidateIncident {
  incident_date: string;
  region: string;
  district: string;
  location_name: string;
  category: string;
  description: string;
  gps_coordinates?: string;
  previous_channel?: string;
}

export interface DuplicateMatch {
  incident: IncidentRow;
  score: number; // 0-100
  reasons: string[];
}

function tokens(s: string): Set<string> {
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((t) => b.has(t) && inter++);
  return inter / (a.size + b.size - inter);
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function parseGps(value?: string | null): [number, number] | null {
  if (!value) return null;
  const parts = value.split(",").map((p) => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1]];
}

/** Haversine distance in meters between two lat/lon pairs. */
function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Trigram-style similarity for short strings (facility/location names). */
function trigramSim(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const trigrams = (s: string): Set<string> => {
    const out = new Set<string>();
    const p = `  ${s} `;
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
    return out;
  };
  const ta = trigrams(A);
  const tb = trigrams(B);
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  return inter / (ta.size + tb.size - inter);
}

export function findPotentialDuplicates(
  candidate: CandidateIncident,
  pool: IncidentRow[]
): DuplicateMatch[] {
  const cTokens = tokens(candidate.description);
  const cGps = parseGps(candidate.gps_coordinates);
  const matches: DuplicateMatch[] = [];

  for (const inc of pool) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Date proximity
    if (candidate.incident_date && inc.incident_date) {
      const diff = daysBetween(candidate.incident_date, inc.incident_date);
      if (diff === 0) {
        score += 25;
        reasons.push("Same incident date");
      } else if (diff <= 3) {
        score += 18;
        reasons.push(`Within ${Math.ceil(diff)} day(s)`);
      } else if (diff <= 7) {
        score += 8;
        reasons.push("Within 1 week");
      } else if (diff <= 30) {
        score += 3;
      }
    }

    // 2. GPS proximity (haversine)
    const iGps = parseGps(inc.gps_coordinates ?? undefined);
    if (cGps && iGps) {
      const dist = distanceMeters(cGps, iGps);
      if (dist <= 100) {
        score += 25;
        reasons.push(`GPS within ${Math.round(dist)}m`);
      } else if (dist <= 500) {
        score += 15;
        reasons.push(`GPS within ${Math.round(dist)}m`);
      } else if (dist <= 2000) {
        score += 6;
        reasons.push(`GPS within ${(dist / 1000).toFixed(1)}km`);
      }
    }

    // 3. Facility / location name match
    const nameSim = trigramSim(candidate.location_name || "", inc.location_name || "");
    if (nameSim >= 0.95) {
      score += 22;
      reasons.push("Identical facility name");
    } else if (nameSim >= 0.6) {
      score += 12;
      reasons.push(`Facility name match (${Math.round(nameSim * 100)}%)`);
    } else if (candidate.district && inc.district === candidate.district) {
      score += 6;
      reasons.push("Same district");
    }

    if (candidate.region && inc.region === candidate.region) score += 3;

    // 4. Category match
    if (candidate.category && inc.category === candidate.category) {
      score += 10;
      reasons.push("Same incident category");
    }

    // 5. Description similarity
    const sim = jaccard(cTokens, tokens(inc.description));
    if (sim > 0.15) {
      const desc = Math.round(sim * 25);
      score += desc;
      reasons.push(`Description similarity ${(sim * 100).toFixed(0)}%`);
    }

    // 6. Previously reported via another channel
    if (
      candidate.previous_channel &&
      inc.previous_channel &&
      candidate.previous_channel.trim().toLowerCase() === inc.previous_channel.trim().toLowerCase()
    ) {
      score += 8;
      reasons.push(`Both flagged from "${inc.previous_channel}"`);
    }

    if (score >= 40) matches.push({ incident: inc, score: Math.min(100, score), reasons });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
