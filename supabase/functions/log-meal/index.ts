// log-meal: turns a photo or description into foods with gram estimates and nutrients
// ("analyze"), then stores the user-confirmed items ("save").

import { askJson, imageBlock, PHOTO_MODEL, textBlock } from "../_shared/claude.ts";
import { HttpError, json, serve } from "../_shared/http.ts";
import { type Nutrients, scale } from "../_shared/nutrients.ts";
import { FOOD_GROUPS } from "../_shared/profile.ts";
import { searchFood } from "../_shared/usda.ts";

const SYSTEM = `You turn a photo or description of a meal into a list of foods for nutrition lookup.

Rules:
- Break mixed dishes into the components a food database lists separately. A burrito becomes flour tortilla, white rice, black beans, chicken, cheese and salsa.
- List cooking oil, butter, dressings and sauces as separate items when you can see them or they are very likely from how the food was cooked.
- grams is your best estimate of the amount eaten, as eaten (cooked weight for cooked foods). grams_low and grams_high give a realistic range. Use visual cues such as plate size (a dinner plate is about 26 cm), cutlery and hands.
- usda_query is a short generic search term that matches USDA FoodData Central descriptions, such as "rice white cooked", "chicken breast roasted" or "olive oil". No brand names.
- food_group is the closest group. Potatoes are "potatoes", not vegetables. Bacon, ham, sausages and deli meats are "processed_meat". Sweetened juice, soda and energy drinks are "sugary_drinks".
- nova is the NOVA processing level: 1 unprocessed or minimally processed, 2 processed culinary ingredient (oil, butter, sugar), 3 processed food (cheese, canned fish, fresh bakery bread), 4 ultra-processed (soft drinks, packaged snacks, mass-produced bread, nuggets, instant noodles).
- questions holds at most two short questions, only when the answer would change the nutrition meaningfully, such as "Was the chicken fried or grilled?". Otherwise leave it empty.
- If there is no food, return no items and one question asking the user to retake the photo or describe the meal.
- Return at most 12 items.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "questions"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "usda_query", "grams", "grams_low", "grams_high", "food_group", "nova"],
        properties: {
          name: { type: "string" },
          usda_query: { type: "string" },
          grams: { type: "number" },
          grams_low: { type: "number" },
          grams_high: { type: "number" },
          food_group: { type: "string", enum: [...FOOD_GROUPS] },
          nova: { type: "integer", enum: [1, 2, 3, 4] },
        },
      },
    },
    questions: { type: "array", items: { type: "string" } },
  },
};

interface IdentifiedFood {
  name: string;
  usda_query: string;
  grams: number;
  grams_low: number;
  grams_high: number;
  food_group: string;
  nova: number;
}

export interface DraftItem extends Omit<IdentifiedFood, "usda_query"> {
  fdc_id: number | null;
  fdc_description: string | null;
  per_100g: Nutrients | null;
  nutrients: Nutrients | null;
}

interface AnalyzeBody {
  action: "analyze";
  text?: string;
  image?: { base64: string; media_type: "image/jpeg" | "image/png" };
}

interface SaveBody {
  action: "save";
  source: "photo" | "text";
  description?: string;
  eaten_at?: string;
  items: Omit<DraftItem, "nutrients">[];
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

serve(async (req, { db, userId }) => {
  const body = (await req.json()) as AnalyzeBody | SaveBody;

  if (body.action === "analyze") {
    if (!body.image && !body.text?.trim()) throw new HttpError(400, "Send a photo or a description.");
    if (body.image && body.image.base64.length * 0.75 > MAX_IMAGE_BYTES) {
      throw new HttpError(413, "Photo is too large. Resize it before uploading.");
    }

    const content = body.image
      ? [
        imageBlock(body.image.base64, body.image.media_type),
        textBlock(body.text?.trim() ? `Notes from the user: ${body.text}` : "Identify the foods in this meal."),
      ]
      : [textBlock(`Meal description: ${body.text}`)];

    const result = await askJson<{ items: IdentifiedFood[]; questions: string[] }>({
      model: PHOTO_MODEL,
      system: SYSTEM,
      content,
      schema: SCHEMA,
      effort: "low",
    });

    const items: DraftItem[] = await Promise.all(
      result.items.map(async ({ usda_query, ...food }) => {
        const match = await searchFood(usda_query);
        return {
          ...food,
          fdc_id: match?.fdc_id ?? null,
          fdc_description: match?.description ?? null,
          per_100g: match?.per_100g ?? null,
          nutrients: match ? scale(match.per_100g, food.grams) : null,
        };
      }),
    );
    return json({ items, questions: result.questions });
  }

  if (body.action === "save") {
    if (!body.items?.length) throw new HttpError(400, "Nothing to save.");
    for (const item of body.items) {
      if (!(FOOD_GROUPS as readonly string[]).includes(item.food_group)) {
        throw new HttpError(400, `Unknown food group: ${item.food_group}`);
      }
      if (!(item.grams >= 0)) throw new HttpError(400, `Invalid amount for ${item.name}`);
    }

    const { data: meal, error } = await db
      .from("meals")
      .insert({
        user_id: userId,
        source: body.source,
        description: body.description ?? null,
        eaten_at: body.eaten_at ?? new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    const rows = body.items.map((item) => ({
      meal_id: meal.id,
      user_id: userId,
      name: item.name,
      grams: item.grams,
      grams_low: item.grams_low,
      grams_high: item.grams_high,
      food_group: item.food_group,
      nova: item.nova,
      fdc_id: item.fdc_id,
      fdc_description: item.fdc_description,
      per_100g: item.per_100g,
      // Recomputed on the server so stored totals always match the confirmed grams.
      nutrients: item.per_100g ? scale(item.per_100g, item.grams) : null,
    }));
    const { error: itemsError } = await db.from("meal_items").insert(rows);
    if (itemsError) {
      await db.from("meals").delete().eq("id", meal.id);
      throw itemsError;
    }
    return json({ meal_id: meal.id });
  }

  throw new HttpError(400, "Unknown action");
});
