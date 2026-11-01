import "server-only";
import { createClient } from "@/lib/supabase/server";
import { totalsOf, type FoodItem, type FoodTotals, type MealType } from "./items";

export interface FoodLog {
  id: string;
  mealType: MealType | null;
  text: string;
  status: "draft" | "confirmed";
  estimated: boolean;
  source: "web" | "telegram";
  loggedAt: string;
  items: FoodItem[];
}

export interface FoodDay {
  /** False until the 0005 migration has run. */
  available: boolean;
  tracking: boolean;
  logs: FoodLog[];
  /** Confirmed meals only; drafts are not counted. */
  totals: FoodTotals;
}

const SELECT =
  "id, date, meal_type, free_text, status, estimated, source, logged_at, food_log_items(item_name, quantity, unit, preparation, kcal_min, kcal_max, protein_g, carbs_g, fat_g, confidence, sort_order)";

type Row = {
  id: string;
  date: string;
  meal_type: MealType | null;
  free_text: string;
  status: "draft" | "confirmed";
  estimated: boolean;
  source: "web" | "telegram";
  logged_at: string;
  food_log_items: (FoodItem & { sort_order: number })[];
};

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toLog(r: Row): FoodLog {
  return {
    id: r.id,
    mealType: r.meal_type,
    text: r.free_text,
    status: r.status,
    estimated: r.estimated,
    source: r.source,
    loggedAt: r.logged_at,
    items: [...(r.food_log_items ?? [])]
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
      })),
  };
}

const EMPTY: FoodTotals = { kcal: null, protein: null, carbs: null, fat: null, missing: 0 };

export async function loadFoodDay(userId: string, date: string): Promise<FoodDay> {
  const supabase = await createClient();
  const [{ data: profile }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("calorie_tracking").eq("user_id", userId).maybeSingle(),
    supabase.from("food_logs").select(SELECT).eq("user_id", userId).eq("date", date).order("logged_at"),
  ]);
  if (error) return { available: false, tracking: true, logs: [], totals: EMPTY };
  const logs = ((data ?? []) as unknown as Row[]).map(toLog);
  return {
    available: true,
    tracking: (profile as { calorie_tracking?: boolean } | null)?.calorie_tracking !== false,
    logs,
    totals: totalsOf(logs.filter((l) => l.status === "confirmed").flatMap((l) => l.items)),
  };
}

export interface FoodDaySummary {
  meals: number;
  totals: FoodTotals;
}

/** Confirmed meals per day between two dates, for the weekly view. Empty if unavailable. */
export async function loadFoodRange(userId: string, from: string, to: string): Promise<{ tracking: boolean; days: Record<string, FoodDaySummary> }> {
  const supabase = await createClient();
  const [{ data: profile }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("calorie_tracking").eq("user_id", userId).maybeSingle(),
    supabase
      .from("food_logs")
      .select(SELECT)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("date", from)
      .lte("date", to),
  ]);
  const tracking = (profile as { calorie_tracking?: boolean } | null)?.calorie_tracking !== false;
  if (error) return { tracking, days: {} };
  const grouped = new Map<string, FoodLog[]>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const list = grouped.get(r.date) ?? [];
    list.push(toLog(r));
    grouped.set(r.date, list);
  }
  const days: Record<string, FoodDaySummary> = {};
  for (const [date, logs] of grouped) days[date] = { meals: logs.length, totals: totalsOf(logs.flatMap((l) => l.items)) };
  return { tracking, days };
}
