import type { IncidentRow } from "./incidents";

export interface CandidateIncident {
  incident_date: string;
  region: string;
  district: string;
  location_name: string;
  category: string;
  description: string;
  gps_coordinates?: string;
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

export function findPotentialDuplicates(
  candidate: CandidateIncident,
  pool: IncidentRow[]
): DuplicateMatch[] {
  const cTokens = tokens(candidate.description);
  const matches: DuplicateMatch[] = [];

  for (const inc of pool) {
    let score = 0;
    const reasons: string[] = [];

    if (candidate.incident_date && inc.incident_date) {
      const diff = daysBetween(candidate.incident_date, inc.incident_date);
      if (diff === 0) {
        score += 30;
        reasons.push("Same incident date");
      } else if (diff <= 3) {
        score += 20;
        reasons.push(`Within ${Math.ceil(diff)} day(s)`);
      } else if (diff <= 7) {
        score += 10;
        reasons.push("Within 1 week");
      }
    }

    if (
      candidate.location_name &&
      inc.location_name.toLowerCase().trim() === candidate.location_name.toLowerCase().trim()
    ) {
      score += 25;
      reasons.push("Identical location/facility");
    } else if (candidate.district && inc.district === candidate.district) {
      score += 10;
      reasons.push("Same district");
    }
    if (candidate.region && inc.region === candidate.region) {
      score += 5;
    }

    if (candidate.category && inc.category === candidate.category) {
      score += 15;
      reasons.push("Same incident category");
    }

    const sim = jaccard(cTokens, tokens(inc.description));
    if (sim > 0.15) {
      const desc = Math.round(sim * 25);
      score += desc;
      reasons.push(`Description similarity ${(sim * 100).toFixed(0)}%`);
    }

    if (score >= 40) matches.push({ incident: inc, score: Math.min(100, score), reasons });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
