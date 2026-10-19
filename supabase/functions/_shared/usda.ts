// Looks up foods in USDA FoodData Central. https://fdc.nal.usda.gov/api-guide
// DEMO_KEY works for trying things out but is heavily rate limited; set USDA_API_KEY.

import { type FdcNutrient, fromFdcNutrients, type Nutrients } from "./nutrients.ts";

const API_KEY = Deno.env.get("USDA_API_KEY") ?? "DEMO_KEY";

export interface FoodMatch {
  fdc_id: number;
  description: string;
  per_100g: Nutrients;
}

interface SearchResponse {
  foods?: { fdcId: number; description: string; foodNutrients?: FdcNutrient[] }[];
}

export async function searchFood(query: string): Promise<FoodMatch | null> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "1");
  // Survey (FNDDS) covers prepared dishes; Foundation and SR Legacy cover whole foods.
  url.searchParams.set("dataType", "Survey (FNDDS),Foundation,SR Legacy");

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`USDA search failed for "${query}": ${res.status}`);
    return null;
  }
  const hit = ((await res.json()) as SearchResponse).foods?.[0];
  if (!hit) return null;
  return { fdc_id: hit.fdcId, description: hit.description, per_100g: fromFdcNutrients(hit.foodNutrients ?? []) };
}
