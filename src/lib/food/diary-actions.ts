"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadDayContext } from "@/lib/day/context";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { ALLERGENS } from "@/lib/onboarding/schema";
import { analyzeText, type Analysis } from "./analyze";
import { mealBySlug } from "@/lib/menu/engine";
import { ideaBySlug, ideaItems, plannedOf, type PlannedIdea } from "./ideas";
import { foodItemSchema, LEGACY_MEAL_TYPES, MEAL_TYPES, type FoodItem, type MealType } from "./items";
import { DAILY_ESTIMATE_LIMIT } from "./limits";
import { TASTE_LIMIT } from "./prefs";

/** Every screen that shows the day's numbers: they update as soon as a meal is saved. */
function refresh() {
  revalidatePath("/progress");
  revalidatePath("/today");
}

async function takeAiQuota(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("take_ai_quota", { p_kind: "food_estimate", p_limit: DAILY_ESTIMATE_LIMIT });
  // Fails open if the quota check itself errors (e.g. migration not applied), so logging works.
  if (error) {
    console.error("take_ai_quota failed", error.message);
    return true;
  }
  return data !== false;
}

const mealText = z.string().trim().min(2).max(1000);

/** "חשב": what was eaten, with the amounts and numbers. Nothing is saved yet. */
export async function analyzeMeal(text: string): Promise<{ ok: true; analysis: Analysis } | { ok: false }> {
  const parsed = mealText.safeParse(text);
  if (!parsed.success) return { ok: false };
  await requireUser();
  try {
    return { ok: true, analysis: await analyzeText(parsed.data, takeAiQuota) };
  } catch (e) {
    console.error("analyzeMeal failed", e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

const addSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  mealType: z.enum(MEAL_TYPES),
  clientRef: z.uuid(),
  items: z.array(foodItemSchema).max(30),
  /** True when the numbers came from an estimate (AI words, a guessed portion). */
  estimated: z.boolean(),
});

/** Before 0013 runs, the new kinds are stored as the closest old one. */
const legacy = (m: MealType): MealType | null => ((LEGACY_MEAL_TYPES as readonly string[]).includes(m) ? m : m === "nibble" ? "snack" : null);
const isCheckError = (e: { code?: string; message?: string } | null) => e?.code === "23514" || /meal_type_check/.test(e?.message ?? "");

/** "אישור והוספה ליומן". */
export async function addMeal(input: z.input<typeof addSchema>): Promise<{ ok: boolean; id?: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const ctx = await loadDayContext(user.id);
  const d = parsed.data;
  const items = d.items.map((i) => (ctx.showNumbers ? i : { ...i, kcal_min: null, kcal_max: null, protein_g: null, carbs_g: null, fat_g: null, confidence: null }));
  const supabase = await createClient();
  const save = (mealType: MealType | null) =>
    supabase.rpc("save_food_log", {
      p_date: localDay(new Date()).date,
      p_meal_type: mealType,
      p_text: d.text,
      p_status: "confirmed",
      p_source: "web",
      p_client_ref: d.clientRef,
      p_estimated: d.estimated && ctx.showNumbers,
      p_items: items,
    });
  let { data, error } = await save(d.mealType);
  if (error && isCheckError(error)) ({ data, error } = await save(legacy(d.mealType)));
  if (error) {
    console.error("addMeal failed", error.message);
    return { ok: false };
  }
  refresh();
  return { ok: true, id: data as string };
}

const updateSchema = z.object({
  id: z.uuid(),
  mealType: z.enum(MEAL_TYPES),
  items: z.array(foodItemSchema).min(1).max(30),
});

/** Editing a saved meal: its kind and its amounts. */
export async function updateMeal(input: z.input<typeof updateSchema>): Promise<{ ok: boolean }> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { id, items } = parsed.data;
  const run = (mealType: MealType | null) => supabase.rpc("update_food_log", { p_id: id, p_meal_type: mealType, p_items: items });
  let { data, error } = await run(parsed.data.mealType);
  if (error && isCheckError(error)) ({ data, error } = await run(legacy(parsed.data.mealType)));
  if (error && /update_food_log|PGRST202|function/i.test(`${error.code} ${error.message}`)) {
    // 0013 not run yet: the same in three calls (own rows only, RLS).
    const ok = await updateWithoutRpc(user.id, id, parsed.data.mealType, items);
    if (ok) refresh();
    return { ok };
  }
  if (error) console.error("updateMeal failed", error.message);
  refresh();
  return { ok: !error && data !== false };
}

async function updateWithoutRpc(userId: string, id: string, mealType: MealType, items: FoodItem[]): Promise<boolean> {
  const supabase = await createClient();
  const up = await supabase.from("food_logs").update({ meal_type: legacy(mealType) }).eq("id", id).eq("user_id", userId).select("id");
  if (up.error || !up.data?.length) return false;
  const del = await supabase.from("food_log_items").delete().eq("food_log_id", id).eq("user_id", userId);
  if (del.error) return false;
  const ins = await supabase.from("food_log_items").insert(items.map((i, k) => ({ ...i, food_log_id: id, user_id: userId, sort_order: k })));
  return !ins.error;
}

export async function deleteMeal(id: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("food_logs").delete().eq("id", id).eq("user_id", user.id);
  refresh();
  return { ok: !error };
}

// ───────────────────────── meal ideas ─────────────────────────

async function readPrefs(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("preferences").eq("user_id", userId).maybeSingle();
  return { supabase, prefs: (data?.preferences as Record<string, unknown> | null) ?? {} };
}

async function writePlanned(userId: string, change: (list: PlannedIdea[]) => PlannedIdea[]): Promise<{ ok: boolean; planned: PlannedIdea[] }> {
  const { supabase, prefs } = await readPrefs(userId);
  const planned = change(plannedOf(prefs.planned_ideas, localDay(new Date()).date)).slice(0, 10);
  const { error } = await supabase.from("profiles").update({ preferences: { ...prefs, planned_ideas: planned } }).eq("user_id", userId);
  if (error) console.error("planned ideas failed", error.message);
  revalidatePath("/progress");
  return { ok: !error, planned };
}

const planSchema = z.object({ slug: z.string().min(1).max(60), kcal: z.number().int().min(80).max(900) });

/** "בחרתי את המנה": kept aside as something to maybe eat today. Not counted. */
export async function planIdea(input: z.input<typeof planSchema>): Promise<{ ok: boolean; planned: PlannedIdea[] }> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success || !mealBySlug(parsed.data.slug)) return { ok: false, planned: [] };
  const user = await requireUser();
  const { date } = localDay(new Date());
  return writePlanned(user.id, (list) => [{ id: crypto.randomUUID(), slug: parsed.data.slug, kcal: parsed.data.kcal, date }, ...list.filter((x) => x.slug !== parsed.data.slug)]);
}

/** "לא אכלתי, להסיר". */
export async function removePlanned(id: string): Promise<{ ok: boolean; planned: PlannedIdea[] }> {
  if (!z.uuid().safeParse(id).success) return { ok: false, planned: [] };
  const user = await requireUser();
  return writePlanned(user.id, (list) => list.filter((x) => x.id !== id));
}

const eatSchema = z.object({ id: z.uuid(), mealType: z.enum(MEAL_TYPES), clientRef: z.uuid() });

/**
 * "אכלתי את המנה": only now does the dish count. Its portions are worked out again here, from the
 * same dish and calories the user saw, so the browser cannot send other numbers.
 */
export async function eatPlanned(input: z.input<typeof eatSchema>): Promise<{ ok: boolean }> {
  const parsed = eatSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const ctx = await loadDayContext(user.id);
  const p = ctx.planned.find((x) => x.id === parsed.data.id);
  const idea = p ? ideaBySlug(p.slug, p.kcal, ctx.profile, ctx.taste) : null;
  if (!p || !idea) return { ok: false };
  const added = await addMeal({ text: idea.title, mealType: parsed.data.mealType, clientRef: parsed.data.clientRef, items: ideaItems(idea.meal, ctx.showNumbers), estimated: false });
  if (added.ok) await writePlanned(user.id, (list) => list.filter((x) => x.id !== p.id));
  return { ok: added.ok };
}

// ───────────────────────── taste ─────────────────────────

const list = z.array(z.string().trim().min(1).max(40)).max(TASTE_LIMIT);
const tasteSchema = z.object({ likes: list, dislikes: list, never: list, allergies: z.array(z.string().max(20)).max(12) });

/** The taste card on the profile: likes, dislikes, "never" and allergies. */
export async function saveTaste(input: z.input<typeof tasteSchema>): Promise<{ ok: boolean }> {
  const parsed = tasteSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const t = parsed.data;
  const allergies = t.allergies.filter((a) => (ALLERGENS as readonly string[]).includes(a));
  const { prefs } = await readPrefs(user.id);
  const [food, profile] = await Promise.all([
    supabase.from("food_preferences").upsert({ user_id: user.id, likes: t.likes, dislikes: t.dislikes, allergies }),
    supabase.from("profiles").update({ preferences: { ...prefs, never_eat: t.never } }).eq("user_id", user.id),
  ]);
  if (food.error || profile.error) console.error("saveTaste failed", food.error?.message ?? profile.error?.message);
  revalidatePath("/profile");
  refresh();
  return { ok: !food.error && !profile.error };
}
