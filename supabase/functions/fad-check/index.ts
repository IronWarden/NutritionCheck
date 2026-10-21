// fad-check: pulls the checkable claims out of pasted text (fast model), matches each
// to the claim library (main model), then rates it with fixed rules.

import { askJson, FAST_MODEL, MAIN_MODEL, textBlock } from "../_shared/claude.ts";
import { HttpError, json, libraryText, loadLibrary, serve, useQuota } from "../_shared/http.ts";
import { type Confidence, WEIGHT } from "../_shared/rules.ts";

const MAX_INPUT_CHARS = 4000;

const EXTRACT_SYSTEM =
  `Extract the specific, checkable claims about food, nutrition, supplements, diets or eating patterns from the user's text.

Rules:
- Return at most 5 claims, most important first.
- Rewrite each as one plain, standalone statement, e.g. "Seed oils cause inflammation".
- Skip opinions, personal stories, jokes and anything not about eating or nutrition.
- Return an empty list if there is nothing checkable.`;

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: { claims: { type: "array", items: { type: "string" } } },
};

const MATCH_RULES = `You compare health claims from social media against a library of evidence-graded claims.

For each claim:
- matched_claim_ids: the library claims that directly address it. Leave empty if none does.
- alignment: "agrees" if the library supports the claim, "contradicts" if the library contradicts it, "partly" if part is supported and part is not, "not_covered" if no library claim addresses it.
- explanation: one or two plain sentences on what the evidence says, using only the matched library claims. No facts, numbers or sources beyond them. Direct, never mocking.

Claim library:`;

const MATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "matched_claim_ids", "alignment", "explanation"],
        properties: {
          claim: { type: "string" },
          matched_claim_ids: { type: "array", items: { type: "string" } },
          alignment: { type: "string", enum: ["agrees", "contradicts", "partly", "not_covered"] },
          explanation: { type: "string" },
        },
      },
    },
  },
};

interface MatchResult {
  claim: string;
  matched_claim_ids: string[];
  alignment: "agrees" | "contradicts" | "partly" | "not_covered";
  explanation: string;
}

const VERDICT = {
  agrees: { verdict: "supported", label: "Supported" },
  contradicts: { verdict: "not_supported", label: "Not supported" },
  partly: { verdict: "partly_supported", label: "Partly supported" },
  not_covered: { verdict: "not_reviewed", label: "Not in our evidence library yet" },
} as const;

serve(async (req, { db, userId }) => {
  const { text } = (await req.json()) as { text?: string };
  const input = text?.trim() ?? "";
  if (!input) throw new HttpError(400, "Paste a claim to check.");
  if (input.length > MAX_INPUT_CHARS) throw new HttpError(413, `Keep it under ${MAX_INPUT_CHARS} characters.`);
  await useQuota(userId, "fad_check");

  const extracted = await askJson<{ claims: string[] }>({
    model: FAST_MODEL,
    system: EXTRACT_SYSTEM,
    content: [textBlock(input)],
    schema: EXTRACT_SCHEMA,
    effort: "low",
  });
  if (extracted.claims.length === 0) {
    return json({ results: [], message: "We couldn't find a checkable nutrition claim in that text." });
  }

  const library = await loadLibrary(db);
  const byId = new Map(library.map((c) => [c.id, c]));
  const matched = await askJson<{ results: MatchResult[] }>({
    model: MAIN_MODEL,
    system: `${MATCH_RULES}\n${libraryText(library)}`,
    content: [textBlock(extracted.claims.slice(0, 5).map((c, i) => `${i + 1}. ${c}`).join("\n"))],
    schema: MATCH_SCHEMA,
    effort: "low",
  });

  const results = matched.results.map((r) => {
    const claims = r.matched_claim_ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    // Unknown ids or no match means we can't give a grounded verdict.
    const alignment = claims.length && claims.length === r.matched_claim_ids.length ? r.alignment : "not_covered";
    const confidence = claims.reduce<Confidence | null>(
      (best, c) => (best === null || WEIGHT[c.confidence] > WEIGHT[best] ? c.confidence : best),
      null,
    );
    return {
      claim: r.claim,
      ...VERDICT[alignment],
      confidence: alignment === "not_covered" ? null : confidence,
      explanation: alignment === "not_covered"
        ? "We haven't reviewed the evidence on this yet. It has been noted for our reviewers."
        : r.explanation,
      claims: alignment === "not_covered"
        ? []
        : claims.map((c) => ({ id: c.id, title: c.title, confidence: c.confidence, source_count: c.sources.length })),
    };
  });

  const { error } = await db.from("fad_checks").insert({ user_id: userId, input, payload: { results } });
  if (error) throw error;
  return json({ results });
});
