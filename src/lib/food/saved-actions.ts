"use server";

import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { understandMeal, type UnderstandMealResult } from "./estimate";
import { DAILY_ESTIMATE_LIMIT } from "./limits";
import { savedFoodOf, type SavedFood } from "./saved";

const text = z.string().trim().min(2).max(1000);

/**
 * What the AI understood from a meal (dish, ingredients, amounts, units made and eaten), for
 * the recipe calculator. The numbers are then counted in the browser by the same code as the
 * server (recipe.ts). Counts against the daily AI quota.
 */
export async function understandFood(input: string): Promise<UnderstandMealResult> {
  const parsed = text.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "failed" };
  await requireUser();
  const supabase = await createClient();
  const { data: allowed, error } = await supabase.rpc("take_ai_quota", { p_kind: "food_estimate", p_limit: DAILY_ESTIMATE_LIMIT });
  if (error) console.error("take_ai_quota failed", error.message);
  else if (allowed === false) return { ok: false, reason: "limit" };
  return understandMeal(parsed.data);
}

const range = z.tuple([z.number().min(0).max(100000), z.number().min(0).max(100000)]);
const nutrition = z.object({ kcal: range, protein: range, carbs: range, fat: range });
const per100 = z.object({ kcal: z.number().min(0).max(900), p: z.number().min(0).max(100), c: z.number().min(0).max(100), f: z.number().min(0).max(100) });
const saveInput = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["recipe", "food"]),
  unitName: z.string().trim().max(30).nullable(),
  yieldUnits: z.number().positive().max(1000).nullable(),
  perUnit: nutrition,
  accuracy: z.enum(["high", "medium", "low"]),
  recipe: z.object({
    understanding: z.object({
      dish: z.string().max(80),
      kind: z.enum(["single", "recipe", "pot_portion"]),
      ingredients: z
        .array(z.object({ name: z.string().min(1).max(80), qty: z.number().positive().max(100000).nullable(), unit: z.string().max(10).nullable(), approx: z.boolean(), per100: per100.nullable() }))
        .min(1)
        .max(25),
      yieldUnits: z.object({ min: z.number().positive(), max: z.number().positive() }).nullable(),
      unitName: z.string().max(30).nullable(),
      eaten: z.object({ min: z.number().positive(), max: z.number().positive() }).nullable(),
    }),
    answers: z.record(z.string().max(10), z.number().positive().max(100000)),
    labels: z.record(z.string().max(3), per100),
  }),
});

/** Saves (or updates, by name) one of the user's recipes or regular foods. */
export async function saveFood(input: z.input<typeof saveInput>): Promise<{ ok: true; food: SavedFood } | { ok: false }> {
  const p = saveInput.safeParse(input);
  if (!p.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const d = p.data;
  const { data, error } = await supabase
    .from("saved_foods")
    .upsert(
      { user_id: user.id, name: d.name, kind: d.kind, unit_name: d.unitName, yield_units: d.yieldUnits, per_unit: d.perUnit, accuracy: d.accuracy, recipe: d.recipe },
      { onConflict: "user_id,name" },
    )
    .select("id, name, kind, unit_name, yield_units, per_unit, recipe, accuracy")
    .single();
  if (error || !data) {
    console.error("saveFood failed", error?.message);
    return { ok: false };
  }
  const food = savedFoodOf(data as Record<string, unknown>);
  return food ? { ok: true, food } : { ok: false };
}

export async function deleteSavedFood(id: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("saved_foods").delete().eq("id", id).eq("user_id", user.id);
  return { ok: !error };
}
