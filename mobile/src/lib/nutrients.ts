import type { NutrientKey } from "./types";

export const NUTRIENT_INFO: Record<NutrientKey, { label: string; unit: string }> = {
  kcal: { label: "Calories", unit: "kcal" },
  protein_g: { label: "Protein", unit: "g" },
  carbs_g: { label: "Carbs", unit: "g" },
  fat_g: { label: "Fat", unit: "g" },
  saturated_fat_g: { label: "Saturated fat", unit: "g" },
  fiber_g: { label: "Fibre", unit: "g" },
  sugars_g: { label: "Total sugars", unit: "g" },
  added_sugar_g: { label: "Added sugar", unit: "g" },
  sodium_mg: { label: "Sodium", unit: "mg" },
  vitamin_a_ug: { label: "Vitamin A", unit: "µg" },
  vitamin_c_mg: { label: "Vitamin C", unit: "mg" },
  vitamin_d_ug: { label: "Vitamin D", unit: "µg" },
  vitamin_e_mg: { label: "Vitamin E", unit: "mg" },
  vitamin_k_ug: { label: "Vitamin K", unit: "µg" },
  b12_ug: { label: "Vitamin B12", unit: "µg" },
  folate_ug: { label: "Folate", unit: "µg" },
  calcium_mg: { label: "Calcium", unit: "mg" },
  iron_mg: { label: "Iron", unit: "mg" },
  magnesium_mg: { label: "Magnesium", unit: "mg" },
  potassium_mg: { label: "Potassium", unit: "mg" },
  zinc_mg: { label: "Zinc", unit: "mg" },
  iodine_ug: { label: "Iodine", unit: "µg" },
  selenium_ug: { label: "Selenium", unit: "µg" },
  epa_dha_mg: { label: "Omega-3 (EPA + DHA)", unit: "mg" },
};

export const DAILY_KEYS: NutrientKey[] = ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"];
export const LIMIT_KEYS: NutrientKey[] = ["saturated_fat_g", "added_sugar_g", "sodium_mg"];
export const MICRO_KEYS: NutrientKey[] = [
  "vitamin_a_ug", "vitamin_c_mg", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug", "b12_ug", "folate_ug",
  "calcium_mg", "iron_mg", "magnesium_mg", "potassium_mg", "zinc_mg", "iodine_ug", "selenium_ug", "epa_dha_mg",
];

export const FOOD_GROUP_LABELS: Record<string, string> = {
  vegetables: "Vegetables", fruit: "Fruit", potatoes: "Potatoes", whole_grains: "Whole grains",
  refined_grains: "Refined grains", legumes: "Legumes", nuts_seeds: "Nuts & seeds", fish_seafood: "Fish & seafood",
  poultry: "Poultry", red_meat: "Red meat", processed_meat: "Processed meat", eggs: "Eggs", dairy: "Dairy",
  plant_oils: "Plant oils", animal_fats: "Butter & animal fats", sweets: "Sweets", sugary_drinks: "Sugary drinks",
  other_drinks: "Other drinks", alcohol: "Alcohol", sauces_condiments: "Sauces", other: "Other",
};

export function formatAmount(value: number | undefined, unit: string): string {
  const v = value ?? 0;
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${unit}`;
}
