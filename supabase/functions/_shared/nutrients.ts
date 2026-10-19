// Nutrients the app tracks, with their USDA FoodData Central nutrient IDs.
// Values from USDA search results are per 100 g of food.

export type NutrientKey =
  | "kcal"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "saturated_fat_g"
  | "fiber_g"
  | "sugars_g"
  | "added_sugar_g"
  | "sodium_mg"
  | "vitamin_a_ug"
  | "vitamin_c_mg"
  | "vitamin_d_ug"
  | "vitamin_e_mg"
  | "vitamin_k_ug"
  | "b12_ug"
  | "folate_ug"
  | "calcium_mg"
  | "iron_mg"
  | "magnesium_mg"
  | "potassium_mg"
  | "zinc_mg"
  | "iodine_ug"
  | "selenium_ug"
  | "epa_dha_mg";

export type Nutrients = Partial<Record<NutrientKey, number>>;

interface NutrientDef {
  label: string;
  unit: "kcal" | "g" | "mg" | "µg";
  // USDA nutrient IDs in order of preference; the first one present is used.
  fdcIds: number[];
}

export const NUTRIENTS: Record<NutrientKey, NutrientDef> = {
  kcal: { label: "Calories", unit: "kcal", fdcIds: [1008, 2047, 2048] },
  protein_g: { label: "Protein", unit: "g", fdcIds: [1003] },
  carbs_g: { label: "Carbohydrate", unit: "g", fdcIds: [1005, 1050] },
  fat_g: { label: "Fat", unit: "g", fdcIds: [1004, 1085] },
  saturated_fat_g: { label: "Saturated fat", unit: "g", fdcIds: [1258] },
  fiber_g: { label: "Fibre", unit: "g", fdcIds: [1079] },
  sugars_g: { label: "Total sugars", unit: "g", fdcIds: [2000, 1063] },
  added_sugar_g: { label: "Added sugar", unit: "g", fdcIds: [1235] },
  sodium_mg: { label: "Sodium", unit: "mg", fdcIds: [1093] },
  vitamin_a_ug: { label: "Vitamin A", unit: "µg", fdcIds: [1106] },
  vitamin_c_mg: { label: "Vitamin C", unit: "mg", fdcIds: [1162] },
  vitamin_d_ug: { label: "Vitamin D", unit: "µg", fdcIds: [1114] },
  vitamin_e_mg: { label: "Vitamin E", unit: "mg", fdcIds: [1109] },
  vitamin_k_ug: { label: "Vitamin K", unit: "µg", fdcIds: [1185] },
  b12_ug: { label: "Vitamin B12", unit: "µg", fdcIds: [1178] },
  folate_ug: { label: "Folate", unit: "µg", fdcIds: [1190, 1177] },
  calcium_mg: { label: "Calcium", unit: "mg", fdcIds: [1087] },
  iron_mg: { label: "Iron", unit: "mg", fdcIds: [1089] },
  magnesium_mg: { label: "Magnesium", unit: "mg", fdcIds: [1090] },
  potassium_mg: { label: "Potassium", unit: "mg", fdcIds: [1092] },
  zinc_mg: { label: "Zinc", unit: "mg", fdcIds: [1095] },
  iodine_ug: { label: "Iodine", unit: "µg", fdcIds: [1100] },
  selenium_ug: { label: "Selenium", unit: "µg", fdcIds: [1103] },
  // EPA (1278) and DHA (1272) are reported in g; summed and converted to mg below.
  epa_dha_mg: { label: "Omega-3 (EPA + DHA)", unit: "mg", fdcIds: [] },
};

export const NUTRIENT_KEYS = Object.keys(NUTRIENTS) as NutrientKey[];

export interface FdcNutrient {
  nutrientId: number;
  value?: number;
}

// Turns a USDA search hit's foodNutrients list into per-100 g values.
export function fromFdcNutrients(list: FdcNutrient[]): Nutrients {
  const byId = new Map<number, number>();
  for (const n of list) {
    if (typeof n.value === "number" && !byId.has(n.nutrientId)) byId.set(n.nutrientId, n.value);
  }
  const out: Nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    const id = NUTRIENTS[key].fdcIds.find((candidate) => byId.has(candidate));
    if (id !== undefined) out[key] = byId.get(id)!;
  }
  const epa = byId.get(1278);
  const dha = byId.get(1272);
  if (epa !== undefined || dha !== undefined) out.epa_dha_mg = ((epa ?? 0) + (dha ?? 0)) * 1000;
  return out;
}

export function scale(per100g: Nutrients, grams: number): Nutrients {
  const out: Nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    const value = per100g[key];
    if (value !== undefined) out[key] = round((value * grams) / 100);
  }
  return out;
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const out: Nutrients = { ...a };
  for (const key of NUTRIENT_KEYS) {
    if (b[key] !== undefined) out[key] = round((out[key] ?? 0) + b[key]!);
  }
  return out;
}

export function divide(n: Nutrients, by: number): Nutrients {
  const out: Nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    if (n[key] !== undefined) out[key] = round(n[key]! / by);
  }
  return out;
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}
