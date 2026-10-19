import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AnalyzeResult, DraftItem, FadResult, NutritionSummary, Verdict } from "./types";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

async function call<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Surface the function's own error message when it sent one.
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw error;
  }
  return data as T;
}

export const api = {
  analyzePhoto: (base64: string, note?: string) =>
    call<AnalyzeResult>("log-meal", { action: "analyze", image: { base64, media_type: "image/jpeg" }, text: note }),
  analyzeText: (text: string) => call<AnalyzeResult>("log-meal", { action: "analyze", text }),
  saveMeal: (source: "photo" | "text", items: DraftItem[], description?: string) =>
    call<{ meal_id: string }>("log-meal", {
      action: "save",
      source,
      description,
      items: items.map(({ nutrients: _ignored, ...item }) => item),
    }),
  summary: () => call<NutritionSummary>("nutrition-summary", { timezone }),
  verdict: () => call<Verdict>("diet-verdict", { timezone }),
  fadCheck: (text: string) => call<{ results: FadResult[]; message?: string }>("fad-check", { text }),
};
