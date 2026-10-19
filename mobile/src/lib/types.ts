// Response shapes from the Supabase functions. Keep in sync with supabase/functions.

export type Confidence = "high" | "moderate" | "low" | "very_low";

export type NutrientKey =
  | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "saturated_fat_g" | "fiber_g"
  | "sugars_g" | "added_sugar_g" | "sodium_mg"
  | "vitamin_a_ug" | "vitamin_c_mg" | "vitamin_d_ug" | "vitamin_e_mg" | "vitamin_k_ug"
  | "b12_ug" | "folate_ug" | "calcium_mg" | "iron_mg" | "magnesium_mg" | "potassium_mg"
  | "zinc_mg" | "iodine_ug" | "selenium_ug" | "epa_dha_mg";

export type Nutrients = Partial<Record<NutrientKey, number>>;

export interface Target {
  key: NutrientKey;
  amount: number;
  kind: "goal" | "limit";
}

export interface Profile {
  id: string;
  birth_year: number | null;
  sex: "female" | "male" | null;
  activity: "sedentary" | "moderate" | "active" | null;
  goals: string[];
  named_diet: string;
  safe_mode: boolean;
  safe_mode_reasons: string[];
  hide_numbers: boolean;
  onboarded: boolean;
}

export interface DraftItem {
  name: string;
  grams: number;
  grams_low: number;
  grams_high: number;
  food_group: string;
  nova: number;
  fdc_id: number | null;
  fdc_description: string | null;
  per_100g: Nutrients | null;
  nutrients: Nutrients | null;
}

export interface AnalyzeResult {
  items: DraftItem[];
  questions: string[];
}

export interface NutritionSummary {
  targets: Target[];
  today: Nutrients;
  week_average: Nutrients;
  days_logged: number;
  hide_numbers: boolean;
}

export interface ClaimRef {
  id: string;
  title: string;
  confidence: Confidence;
  summary?: string;
  source_count: number;
}

export interface VerdictItem {
  text: string;
  claims: ClaimRef[];
}

export interface Verdict {
  id: string;
  rating: string;
  rating_label: string;
  confidence: Confidence | null;
  days_logged: number;
  named_diet: string | null;
  strengths: VerdictItem[];
  gaps: VerdictItem[];
  suggestions: VerdictItem[];
  diet_evidence: ClaimRef[];
  related: ClaimRef[];
  safe_mode_note: string | null;
}

export interface FadResult {
  claim: string;
  verdict: "supported" | "not_supported" | "partly_supported" | "not_reviewed";
  label: string;
  confidence: Confidence | null;
  explanation: string;
  claims: ClaimRef[];
}

export interface Claim {
  id: string;
  category: string;
  title: string;
  exposure: string;
  outcome: string;
  population: string;
  direction: string;
  effect: string;
  confidence: Confidence;
  confidence_reasons: string;
  summary: string;
  sources: { citation: string; design: string; tier: number; url: string }[];
  review_status: "draft" | "approved";
}
