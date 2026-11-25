import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/plan/week";
import type { FoodItem, MealType } from "./items";

export interface RecentMeal {
  text: string;
  mealType: MealType | null;
  items: FoodItem[];
  /** How many times it was logged in the last weeks. */
  times: number;
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const key = (s: string) => s.replace(/\s*\(מהתפריט\)\s*$/, "").replace(/[.,!]+$/g, "").replace(/\s+/g, " ").trim();

/**
 * Meals logged in the last 30 days, the most frequent and most recent first, one per text, with
 * the items as they were counted (so logging one again needs no counting at all).
 */
export async function loadRecentMeals(userId: string, today: string, limit = 8): Promise<RecentMeal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_logs")
    .select("free_text, meal_type, logged_at, food_log_items(item_name, quantity, unit, preparation, kcal_min, kcal_max, protein_g, carbs_g, fat_g, confidence, sort_order)")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("date", addDays(today, -30))
    .order("logged_at", { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const byText = new Map<string, RecentMeal>();
  for (const r of data as unknown as { free_text: string; meal_type: MealType | null; food_log_items: (FoodItem & { sort_order: number })[] }[]) {
    const k = key(r.free_text);
    if (k.length < 2) continue;
    const seen = byText.get(k);
    if (seen) {
      seen.times++;
      continue;
    }
    const items = [...(r.food_log_items ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        item_name: i.item_name,
        unit: i.unit,
        preparation: i.preparation,
        confidence: i.confidence,
        quantity: n(i.quantity),
        kcal_min: n(i.kcal_min),
        kcal_max: n(i.kcal_max),
        protein_g: n(i.protein_g),
        carbs_g: n(i.carbs_g),
        fat_g: n(i.fat_g),
      }));
    byText.set(k, { text: k, mealType: r.meal_type, items, times: 1 });
  }
  return [...byText.values()].sort((a, b) => (b.times > 1 ? 1 : 0) - (a.times > 1 ? 1 : 0)).slice(0, limit);
}
