// Builds the diet profile: daily nutrient averages and the pattern "signals" that
// claim triggers are evaluated against.

import { add, divide, NUTRIENT_KEYS, type Nutrients, round } from "./nutrients.ts";
import type { Target } from "./targets.ts";

export const FOOD_GROUPS = [
  "vegetables",
  "fruit",
  "potatoes",
  "whole_grains",
  "refined_grains",
  "legumes",
  "nuts_seeds",
  "fish_seafood",
  "poultry",
  "red_meat",
  "processed_meat",
  "eggs",
  "dairy",
  "plant_oils",
  "animal_fats",
  "sweets",
  "sugary_drinks",
  "other_drinks",
  "alcohol",
  "sauces_condiments",
  "other",
] as const;

export type FoodGroup = typeof FOOD_GROUPS[number];

// Rough grams per serving, as eaten. Used only to turn grams into servings for the signals.
const SERVING_GRAMS: Partial<Record<FoodGroup, number>> = {
  vegetables: 80,
  fruit: 80,
  whole_grains: 50,
  legumes: 80,
  nuts_seeds: 28,
  fish_seafood: 100,
  red_meat: 100,
  processed_meat: 50,
  sugary_drinks: 250,
};

export interface ProfileItem {
  eaten_at: string;
  grams: number;
  food_group: string;
  nova: number | null;
  nutrients: Nutrients | null;
}

export type Signals = Record<string, number>;

export interface DietProfile {
  days_logged: number;
  daily_average: Nutrients;
  signals: Signals;
}

export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));
}

// USDA rarely reports added sugar, so for sweets and sugary drinks total sugar stands in for it.
function withAddedSugarEstimate(item: ProfileItem): Nutrients {
  const n = item.nutrients ?? {};
  if (n.added_sugar_g !== undefined) return n;
  if (item.food_group === "sweets" || item.food_group === "sugary_drinks") {
    return { ...n, added_sugar_g: n.sugars_g ?? 0 };
  }
  return n;
}

export function signalName(key: string): string {
  return `${key.replace(/_(ug|mg|g)$/, "")}_pct_target`;
}

export function buildProfile(items: ProfileItem[], timeZone: string, targets: Target[]): DietProfile {
  const days = new Set(items.map((i) => localDate(i.eaten_at, timeZone)));
  const daysLogged = days.size;
  if (daysLogged === 0) return { days_logged: 0, daily_average: {}, signals: { days_logged: 0 } };

  let total: Nutrients = {};
  let upfKcal = 0;
  const gramsByGroup = new Map<string, number>();
  for (const item of items) {
    const n = withAddedSugarEstimate(item);
    total = add(total, n);
    if (item.nova === 4) upfKcal += n.kcal ?? 0;
    gramsByGroup.set(item.food_group, (gramsByGroup.get(item.food_group) ?? 0) + item.grams);
  }

  const daily = divide(total, daysLogged);
  const servingsPerDay = (group: FoodGroup) => (gramsByGroup.get(group) ?? 0) / SERVING_GRAMS[group]! / daysLogged;
  const kcal = daily.kcal ?? 0;

  const signals: Signals = {
    days_logged: daysLogged,
    fiber_g_per_day: daily.fiber_g ?? 0,
    sodium_mg_per_day: daily.sodium_mg ?? 0,
    saturated_fat_pct_kcal: kcal ? round(((daily.saturated_fat_g ?? 0) * 9 / kcal) * 100) : 0,
    added_sugar_pct_kcal: kcal ? round(((daily.added_sugar_g ?? 0) * 4 / kcal) * 100) : 0,
    ultra_processed_kcal_share: total.kcal ? round((upfKcal / total.kcal) * 100) / 100 : 0,
    fruit_veg_servings_per_day: round(servingsPerDay("vegetables") + servingsPerDay("fruit")),
    whole_grain_servings_per_day: round(servingsPerDay("whole_grains")),
    legume_servings_per_week: round(servingsPerDay("legumes") * 7),
    nut_servings_per_week: round(servingsPerDay("nuts_seeds") * 7),
    fish_servings_per_week: round(servingsPerDay("fish_seafood") * 7),
    red_meat_servings_per_week: round(servingsPerDay("red_meat") * 7),
    processed_meat_servings_per_week: round(servingsPerDay("processed_meat") * 7),
    sugary_drink_servings_per_week: round(servingsPerDay("sugary_drinks") * 7),
  };

  for (const target of targets) {
    if (target.kind !== "goal" || !NUTRIENT_KEYS.includes(target.key)) continue;
    signals[signalName(target.key)] = Math.round(((daily[target.key] ?? 0) / target.amount) * 100);
  }

  return { days_logged: daysLogged, daily_average: daily, signals };
}
