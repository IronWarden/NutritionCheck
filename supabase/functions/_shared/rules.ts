// Fixed rules that turn a diet profile and the claim library into a verdict.
// The language model never decides a rating; it only explains the claims chosen here.

import type { Signals } from "./profile.ts";

export type Confidence = "high" | "moderate" | "low" | "very_low";
export type Stance = "gap" | "strength" | "info";

export interface Trigger {
  signal: string;
  op: "<" | "<=" | ">" | ">=";
  value: number;
  stance: Stance;
}

export interface Claim {
  id: string;
  category: string;
  title: string;
  direction: string;
  effect: string;
  confidence: Confidence;
  summary: string;
  triggers: Trigger[];
  sources: { citation: string; design: string; tier: number; url: string }[];
}

export interface Match {
  claim: Claim;
  stance: Stance | "diet";
  signal?: string;
  user_value?: number;
  threshold?: number;
}

export type Rating =
  | "supported"
  | "mostly_supported"
  | "mixed"
  | "not_supported"
  | "insufficient_evidence"
  | "insufficient_data";

export interface VerdictCore {
  rating: Rating;
  confidence: Confidence | null;
  strengths: Match[];
  gaps: Match[];
  info: Match[];
  diet: Match[];
}

export const MIN_DAYS = 3;
const MAX_SHOWN = 3;

export const WEIGHT: Record<Confidence, number> = { high: 3, moderate: 2, low: 1, very_low: 0 };
const ORDER: Confidence[] = ["very_low", "low", "moderate", "high"];

function passes(op: Trigger["op"], value: number, threshold: number): boolean {
  switch (op) {
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
  }
}

export function matchClaims(claims: Claim[], signals: Signals, dietClaimIds: string[] = []): Match[] {
  const matches: Match[] = [];
  for (const claim of claims) {
    for (const trigger of claim.triggers) {
      const value = signals[trigger.signal];
      if (value === undefined || !passes(trigger.op, value, trigger.value)) continue;
      matches.push({
        claim,
        stance: trigger.stance,
        signal: trigger.signal,
        user_value: value,
        threshold: trigger.value,
      });
      break; // one stance per claim
    }
  }
  const matched = new Set(matches.map((m) => m.claim.id));
  for (const id of dietClaimIds) {
    const claim = claims.find((c) => c.id === id);
    if (claim && !matched.has(id)) matches.push({ claim, stance: "diet" });
  }
  return matches;
}

export interface Explained {
  text: string;
  claim_ids: string[];
}

// The citation check: keep only explanations that cite at least one claim, all from the allowed set.
export function cited(items: Explained[], allowed: Set<string>): Explained[] {
  return items.filter((item) => item.claim_ids.length > 0 && item.claim_ids.every((id) => allowed.has(id)));
}

const byWeight = (a: Match, b: Match) => WEIGHT[b.claim.confidence] - WEIGHT[a.claim.confidence];

export function decide(matches: Match[], daysLogged: number): VerdictCore {
  const gaps = matches.filter((m) => m.stance === "gap").sort(byWeight);
  const strengths = matches.filter((m) => m.stance === "strength").sort(byWeight);
  const info = matches.filter((m) => m.stance === "info");
  const diet = matches.filter((m) => m.stance === "diet");

  const shown = { strengths: strengths.slice(0, MAX_SHOWN), gaps: gaps.slice(0, MAX_SHOWN), info, diet };
  if (daysLogged < MIN_DAYS) return { rating: "insufficient_data", confidence: null, ...shown };

  const scored = [...gaps, ...strengths].filter((m) => WEIGHT[m.claim.confidence] > 0);
  if (scored.length === 0) return { rating: "insufficient_evidence", confidence: null, ...shown };

  const sum = (list: Match[]) => list.reduce((total, m) => total + WEIGHT[m.claim.confidence], 0);
  const net = sum(strengths) - sum(gaps);
  const highGaps = gaps.filter((m) => m.claim.confidence === "high").length;

  let rating: Rating;
  if (highGaps >= 2 || net <= -4) rating = "not_supported";
  else if (gaps.length === 0 && net >= 3) rating = "supported";
  else if (net >= 0) rating = "mostly_supported";
  else rating = "mixed";

  // Overall confidence is the weakest of the three claims that carry the most weight.
  const top = [...scored].sort(byWeight).slice(0, 3);
  const confidence = top.reduce<Confidence>(
    (lowest, m) => (ORDER.indexOf(m.claim.confidence) < ORDER.indexOf(lowest) ? m.claim.confidence : lowest),
    "high",
  );

  return { rating, confidence, ...shown };
}
