// diet-verdict: judges the last 14 days of eating against the claim library.
// Fixed rules pick the rating and the claims; Claude only writes the plain-language
// explanation, and any sentence that doesn't cite a selected claim is dropped.

import { askJson, MAIN_MODEL, textBlock } from "../_shared/claude.ts";
import { json, libraryText, loadLibrary, loadProfile, loadRecentItems, serve, targetsFor } from "../_shared/http.ts";
import { buildProfile } from "../_shared/profile.ts";
import {
  cited,
  type Claim,
  decide,
  type Explained,
  type Match,
  matchClaims,
  MIN_DAYS,
  type Rating,
} from "../_shared/rules.ts";

const RATING_LABEL: Record<Rating, string> = {
  supported: "Supported by the evidence",
  mostly_supported: "Mostly supported",
  mixed: "Mixed",
  not_supported: "Not supported by the evidence",
  insufficient_evidence: "Not enough evidence to judge",
  insufficient_data: `Log at least ${MIN_DAYS} days to get a verdict`,
};

const SYSTEM_RULES =
  `You explain a diet verdict to a user of a nutrition app. The verdict and the claims behind it were already chosen by fixed rules; you only explain them.

Rules:
- Use only the claims listed in the user's findings. Never add facts, numbers or advice that are not in those claims.
- Every item must list the ids of the claims it is based on in claim_ids.
- strengths: one item per strength finding. gaps: one item per gap finding. Mention the user's own number where one is given, e.g. "You're averaging 14 g of fibre a day".
- suggestions: at most two specific, easy changes that close the biggest gaps, each tied to a gap claim. Leave it empty if there are no gaps or if safe_mode is true.
- Plain language for a general reader. One or two short sentences per item. Direct and factual, never judgemental. No emoji.

Claim library (for reference; cite only claims that appear in the findings):`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["strengths", "gaps", "suggestions"],
  properties: Object.fromEntries(
    ["strengths", "gaps", "suggestions"].map((key) => [key, {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "claim_ids"],
        properties: { text: { type: "string" }, claim_ids: { type: "array", items: { type: "string" } } },
      },
    }]),
  ),
};

const claimRef = (c: Claim) => ({
  id: c.id,
  title: c.title,
  confidence: c.confidence,
  summary: c.summary,
  source_count: c.sources.length,
});

const finding = (m: Match) => ({
  claim_id: m.claim.id,
  claim: m.claim.title,
  confidence: m.claim.confidence,
  ...(m.signal ? { signal: m.signal, user_value: m.user_value, threshold: m.threshold } : {}),
});

serve(async (req, { db, userId }) => {
  const { timezone = "UTC" } = (await req.json().catch(() => ({}))) as { timezone?: string };
  const profile = await loadProfile(db, userId);
  const [claims, items, dietRow] = await Promise.all([
    loadLibrary(db),
    loadRecentItems(db, 14),
    db.from("diets").select("name, claim_ids").eq("id", profile.named_diet).maybeSingle(),
  ]);

  const dietProfile = buildProfile(items, timezone, targetsFor(profile));
  const matches = matchClaims(claims, dietProfile.signals, dietRow.data?.claim_ids ?? []);
  const core = decide(matches, dietProfile.days_logged);

  let explained = { strengths: [] as Explained[], gaps: [] as Explained[], suggestions: [] as Explained[] };
  if (core.rating !== "insufficient_data" && (core.strengths.length || core.gaps.length)) {
    const findings = {
      named_diet: dietRow.data?.name ?? "none",
      days_logged: dietProfile.days_logged,
      safe_mode: profile.safe_mode,
      strengths: core.strengths.map(finding),
      gaps: core.gaps.map(finding),
    };
    explained = await askJson({
      model: MAIN_MODEL,
      system: `${SYSTEM_RULES}\n${libraryText(claims)}`,
      content: [textBlock(`Findings:\n${JSON.stringify(findings, null, 2)}`)],
      schema: SCHEMA,
      effort: "medium",
    });
    const strengthIds = new Set(core.strengths.map((m) => m.claim.id));
    const gapIds = new Set(core.gaps.map((m) => m.claim.id));
    explained = {
      strengths: cited(explained.strengths, strengthIds),
      gaps: cited(explained.gaps, gapIds),
      suggestions: profile.safe_mode ? [] : cited(explained.suggestions, gapIds).slice(0, 2),
    };
  }

  const byId = new Map(claims.map((c) => [c.id, c]));
  const withRefs = (list: Explained[]) =>
    list.map((item) => ({ text: item.text, claims: item.claim_ids.map((id) => claimRef(byId.get(id)!)) }));

  const payload = {
    rating: core.rating,
    rating_label: RATING_LABEL[core.rating],
    confidence: core.confidence,
    days_logged: dietProfile.days_logged,
    named_diet: dietRow.data?.name ?? null,
    strengths: withRefs(explained.strengths),
    gaps: withRefs(explained.gaps),
    suggestions: withRefs(explained.suggestions),
    diet_evidence: core.diet.map((m) => claimRef(m.claim)),
    related: core.info.map((m) => claimRef(m.claim)),
    safe_mode_note: profile.safe_mode
      ? "Personal suggestions are switched off. A doctor or registered dietitian can give advice that fits your health."
      : null,
  };

  const usedIds = [...core.strengths, ...core.gaps, ...core.diet, ...core.info].map((m) => m.claim.id);
  const { data: saved, error } = await db
    .from("verdicts")
    .insert({ user_id: userId, rating: core.rating, confidence: core.confidence, payload, claim_ids: usedIds })
    .select("id")
    .single();
  if (error) throw error;

  return json({ id: saved.id, ...payload });
});
