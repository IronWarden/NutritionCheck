import { assert, assertEquals } from "jsr:@std/assert@1";
import { fromFdcNutrients, scale } from "../_shared/nutrients.ts";
import { buildProfile, type ProfileItem } from "../_shared/profile.ts";
import { cited, type Claim, decide, matchClaims } from "../_shared/rules.ts";
import { dailyTargets } from "../_shared/targets.ts";

const library = JSON.parse(await Deno.readTextFile(new URL("../../../data/claims.json", import.meta.url)));
const claims: Claim[] = library.claims.map((c: Claim) => ({
  ...c,
  sources: c.sources.map((s) => ({ ...s, url: "" })),
}));
const targets = dailyTargets({ age: 30, sex: "female", activity: "moderate" });

const day = (n: number, hour = 12) => new Date(Date.UTC(2026, 9, n, hour)).toISOString();
const item = (
  eaten_at: string,
  food_group: string,
  grams: number,
  nutrients: ProfileItem["nutrients"],
  nova = 1,
): ProfileItem => ({ eaten_at, food_group, grams, nova, nutrients });

Deno.test("USDA nutrients map to keys, preferring the first listed ID and combining EPA + DHA", () => {
  const n = fromFdcNutrients([
    { nutrientId: 1008, value: 200 },
    { nutrientId: 2047, value: 999 },
    { nutrientId: 1079, value: 3 },
    { nutrientId: 1278, value: 0.5 },
    { nutrientId: 1272, value: 1.0 },
  ]);
  assertEquals(n.kcal, 200);
  assertEquals(n.fiber_g, 3);
  assertEquals(n.epa_dha_mg, 1500);
  assertEquals(scale(n, 50).kcal, 100);
});

Deno.test("targets follow reference intakes", () => {
  const byKey = Object.fromEntries(targets.map((t) => [t.key, t]));
  assertEquals(byKey.kcal.amount, 2100);
  assertEquals(byKey.iron_mg.amount, 18);
  assertEquals(byKey.fiber_g.amount, 29);
  assertEquals(byKey.sodium_mg.kind, "limit");
  const older = Object.fromEntries(
    dailyTargets({ age: 60, sex: "female", activity: "moderate" }).map((t) => [t.key, t]),
  );
  assertEquals(older.iron_mg.amount, 8);
  assertEquals(older.calcium_mg.amount, 1200);
});

Deno.test("profile averages over days logged and converts grams to servings", () => {
  const items = [
    item(day(1), "processed_meat", 100, { kcal: 300, fiber_g: 0, saturated_fat_g: 10 }, 4),
    item(day(2), "legumes", 160, { kcal: 200, fiber_g: 12 }),
    item(day(2, 18), "vegetables", 240, { kcal: 100, fiber_g: 6 }),
  ];
  const p = buildProfile(items, "UTC", targets);
  assertEquals(p.days_logged, 2);
  assertEquals(p.daily_average.kcal, 300);
  assertEquals(p.signals.fiber_g_per_day, 9);
  assertEquals(p.signals.processed_meat_servings_per_week, 7); // 2 servings over 2 days
  assertEquals(p.signals.legume_servings_per_week, 7);
  assertEquals(p.signals.fruit_veg_servings_per_day, 1.5);
  assertEquals(p.signals.ultra_processed_kcal_share, 0.5);
  assertEquals(p.signals.saturated_fat_pct_kcal, 15);
});

Deno.test("days are counted in the user's time zone", () => {
  // 02:00 UTC on Oct 2 is still Oct 1 in Los Angeles.
  const items = [item(day(1, 20), "fruit", 80, { kcal: 50 }), item(day(2, 2), "fruit", 80, { kcal: 50 })];
  assertEquals(buildProfile(items, "UTC", targets).days_logged, 2);
  assertEquals(buildProfile(items, "America/Los_Angeles", targets).days_logged, 1);
});

Deno.test("a low-fibre, high-processed-meat diet is not supported", () => {
  const signals = {
    days_logged: 5,
    fiber_g_per_day: 9,
    processed_meat_servings_per_week: 8,
    sodium_mg_per_day: 3400,
    fruit_veg_servings_per_day: 1,
    saturated_fat_pct_kcal: 16,
  };
  const matches = matchClaims(claims, signals, ["carnivore-long-term"]);
  const verdict = decide(matches, 5);
  assertEquals(verdict.rating, "not_supported");
  assertEquals(verdict.gaps[0].claim.confidence, "high");
  assertEquals(verdict.diet.map((m) => m.claim.id), ["carnivore-long-term"]);
  assert(verdict.gaps.length <= 3);
});

Deno.test("a fibre-rich diet with no gaps is supported", () => {
  const signals = {
    days_logged: 7,
    fiber_g_per_day: 32,
    fruit_veg_servings_per_day: 6,
    legume_servings_per_week: 4,
    processed_meat_servings_per_week: 0,
    saturated_fat_pct_kcal: 8,
    sugary_drink_servings_per_week: 0,
  };
  const verdict = decide(matchClaims(claims, signals), 7);
  assertEquals(verdict.rating, "supported");
  assertEquals(verdict.gaps.length, 0);
});

Deno.test("fewer than three days logged gives no rating", () => {
  const verdict = decide(matchClaims(claims, { days_logged: 2, fiber_g_per_day: 5 }), 2);
  assertEquals(verdict.rating, "insufficient_data");
  assertEquals(verdict.confidence, null);
});

Deno.test("citation check drops uncited or out-of-scope explanations", () => {
  const allowed = new Set(["fiber-chronic-disease"]);
  const kept = cited([
    { text: "ok", claim_ids: ["fiber-chronic-disease"] },
    { text: "no citation", claim_ids: [] },
    { text: "invented claim", claim_ids: ["fiber-chronic-disease", "made-up"] },
  ], allowed);
  assertEquals(kept.map((k) => k.text), ["ok"]);
});

Deno.test("every claim trigger names a signal the profile produces", () => {
  const items = [item(day(1), "fruit", 80, { kcal: 50 })];
  const known = new Set(Object.keys(buildProfile(items, "UTC", targets).signals));
  for (const c of claims) {
    for (const t of c.triggers) assert(known.has(t.signal), `${c.id} uses unknown signal ${t.signal}`);
  }
});
