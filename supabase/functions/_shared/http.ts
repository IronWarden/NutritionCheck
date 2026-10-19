// Request helpers shared by every function.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ProfileItem } from "./profile.ts";
import type { Claim } from "./rules.ts";
import { type Activity, ageFromBirthYear, dailyTargets, type Sex, type Target } from "./targets.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Wraps a handler with CORS, auth and error handling. The Supabase client acts as the
// signed-in user, so row level security applies to every query.
export function serve(handler: (req: Request, ctx: { db: SupabaseClient; userId: string }) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      const db = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
        {
          global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
        },
      );
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) throw new HttpError(401, "Not signed in");
      return await handler(req, { db, userId: data.user.id });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      console.error(err);
      return json({ error: err instanceof Error ? err.message : "Unexpected error" }, status);
    }
  });
}

export interface Profile {
  birth_year: number | null;
  sex: Sex | null;
  activity: Activity | null;
  named_diet: string;
  safe_mode: boolean;
  hide_numbers: boolean;
}

export async function loadProfile(db: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .select("birth_year, sex, activity, named_diet, safe_mode, hide_numbers")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export function targetsFor(profile: Profile): Target[] {
  return dailyTargets({
    age: ageFromBirthYear(profile.birth_year) ?? 35,
    sex: profile.sex ?? "female",
    activity: profile.activity ?? "moderate",
  });
}

export async function loadLibrary(db: SupabaseClient): Promise<Claim[]> {
  const { data, error } = await db
    .from("claims")
    .select("id, category, title, direction, effect, confidence, summary, triggers, sources")
    .order("id");
  if (error) throw error;
  return data as Claim[];
}

// Logged food items from the last `days` days, flattened with the meal's time.
export async function loadRecentItems(db: SupabaseClient, days: number): Promise<ProfileItem[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("meal_items")
    .select("grams, food_group, nova, nutrients, meals!inner(eaten_at)")
    .gte("meals.eaten_at", since);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const meal = row.meals as unknown as { eaten_at: string };
    return {
      eaten_at: meal.eaten_at,
      grams: row.grams,
      food_group: row.food_group,
      nova: row.nova,
      nutrients: row.nutrients,
    };
  });
}

// The claim library as compact, deterministic text for a cached system prompt.
export function libraryText(claims: Claim[]): string {
  return claims
    .map((c) => `[${c.id}] (${c.confidence} confidence, ${c.direction}) ${c.title}. ${c.effect}`)
    .join("\n");
}
