// Daily nutrient targets from official reference intakes.
// Micronutrients: US Dietary Reference Intakes (RDA or AI) for adults.
// Calories: approximate estimated needs from the US Dietary Guidelines 2020-2025, by
// sex, age band and activity level. Limits (sodium, saturated fat, added sugar) are maximums.

import type { NutrientKey } from "./nutrients.ts";

export type Sex = "female" | "male";
export type Activity = "sedentary" | "moderate" | "active";

export interface Target {
  key: NutrientKey;
  amount: number;
  kind: "goal" | "limit";
}

type AgeBand = "19-30" | "31-50" | "51-70" | "71+";

const CALORIES: Record<Sex, Record<AgeBand, [number, number, number]>> = {
  male: {
    "19-30": [2400, 2700, 3000],
    "31-50": [2300, 2500, 2900],
    "51-70": [2100, 2350, 2700],
    "71+": [2000, 2200, 2500],
  },
  female: {
    "19-30": [1900, 2100, 2400],
    "31-50": [1800, 2000, 2200],
    "51-70": [1600, 1800, 2100],
    "71+": [1600, 1800, 2000],
  },
};

const ACTIVITY_INDEX: Record<Activity, 0 | 1 | 2> = { sedentary: 0, moderate: 1, active: 2 };

export function ageBand(age: number): AgeBand {
  if (age <= 30) return "19-30";
  if (age <= 50) return "31-50";
  if (age <= 70) return "51-70";
  return "71+";
}

export interface TargetInput {
  age: number;
  sex: Sex;
  activity: Activity;
}

export function dailyTargets({ age, sex, activity }: TargetInput): Target[] {
  const band = ageBand(age);
  const kcal = CALORIES[sex][band][ACTIVITY_INDEX[activity]];
  const male = sex === "male";
  const older = band === "51-70" || band === "71+";

  const goals: [NutrientKey, number][] = [
    ["kcal", kcal],
    ["protein_g", male ? 56 : 46],
    // Fibre AI is 14 g per 1,000 kcal.
    ["fiber_g", Math.round((kcal / 1000) * 14)],
    ["vitamin_a_ug", male ? 900 : 700],
    ["vitamin_c_mg", male ? 90 : 75],
    ["vitamin_d_ug", band === "71+" ? 20 : 15],
    ["vitamin_e_mg", 15],
    ["vitamin_k_ug", male ? 120 : 90],
    ["b12_ug", 2.4],
    ["folate_ug", 400],
    ["calcium_mg", band === "71+" || (!male && older) ? 1200 : 1000],
    ["iron_mg", !male && !older ? 18 : 8],
    ["magnesium_mg", male ? (band === "19-30" ? 400 : 420) : (band === "19-30" ? 310 : 320)],
    ["potassium_mg", male ? 3400 : 2600],
    ["zinc_mg", male ? 11 : 8],
    ["iodine_ug", 150],
    ["selenium_ug", 55],
    // No US DRI; EFSA's adequate intake for EPA + DHA.
    ["epa_dha_mg", 250],
  ];

  const limits: [NutrientKey, number][] = [
    ["sodium_mg", 2300],
    // Under 10% of calories; fat has 9 kcal per g, sugar 4 kcal per g.
    ["saturated_fat_g", Math.round((kcal * 0.1) / 9)],
    ["added_sugar_g", Math.round((kcal * 0.1) / 4)],
  ];

  return [
    ...goals.map(([key, amount]) => ({ key, amount, kind: "goal" as const })),
    ...limits.map(([key, amount]) => ({ key, amount, kind: "limit" as const })),
  ];
}

export function ageFromBirthYear(birthYear: number | null, now = new Date()): number | null {
  return birthYear ? now.getFullYear() - birthYear : null;
}
