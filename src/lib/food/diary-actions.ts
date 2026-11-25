"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadDayContext } from "@/lib/day/context";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { ALLERGENS } from "@/lib/onboarding/schema";
import { analyzeText, type Analysis } from "./analyze";
import { loadFoodDay } from "./data";
import { ideaBySlug, ideaItems, IDEA_KINDS, SIZES } from "./ideas";
import { foodItemSchema, LEGACY_MEAL_TYPES, MEAL_TYPES, type FoodItem, type MealType } from "./items";
import { DAILY_ESTIMATE_LIMIT } from "./limits";
import { describePhoto, type PhotoResult } from "./photo";
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

const photo = z.object({
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  // About 1.4 MB of base64 at most; the browser shrinks photos to ~1024 px before sending.
  data: z.string().min(100).max(1_900_000).regex(/^[A-Za-z0-9+/=]+$/),
});

/** "צילום אוכל": the photo becomes a line of text the user can still change. */
export async function readMealPhoto(input: z.input<typeof photo>): Promise<PhotoResult | { ok: false; reason: "limit" }> {
  const parsed = photo.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "failed" };
  await requireUser();
  if (!(await takeAiQuota())) return { ok: false, reason: "limit" };
  return describePhoto(parsed.data.data, parsed.data.mime);
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

const ideaSchema = z.object({
  slug: z.string().min(1).max(60),
  kind: z.enum(IDEA_KINDS),
  size: z.enum(SIZES),
  clientRef: z.uuid(),
});

const IDEA_MEAL: Record<(typeof IDEA_KINDS)[number], MealType | null> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
  sweet: "nibble",
  protein: null,
};

/**
 * "אכלתי את זה": only now does an idea count. The portions are worked out again here, from the
 * same meal and the same numbers the user saw, so the browser cannot send other numbers.
 */
export async function eatIdea(input: z.input<typeof ideaSchema>): Promise<{ ok: boolean }> {
  const parsed = ideaSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const ctx = await loadDayContext(user.id);
  const { date, minutes } = localDay(new Date());
  const day = await loadFoodDay(user.id, date).catch(() => null);
  const eaten = day?.totals.kcal ? Math.round((day.totals.kcal[0] + day.totals.kcal[1]) / 2) : 0;
  const idea = ideaBySlug(parsed.data.slug, {
    kind: parsed.data.kind,
    target: ctx.target,
    eatenKcal: eaten,
    proteinTarget: ctx.protein,
    eatenProtein: day?.totals.protein ?? 0,
    profile: ctx.profile,
    taste: ctx.taste,
    minutes,
  });
  if (!idea) return { ok: false };
  const meal = idea.sizes[parsed.data.size];
  const mealType = IDEA_MEAL[parsed.data.kind] ?? (minutes < 11 * 60 ? "breakfast" : minutes < 16 * 60 ? "lunch" : "dinner");
  return addMeal({ text: meal.title, mealType, clientRef: parsed.data.clientRef, items: ideaItems(meal, ctx.showNumbers), estimated: false });
}

const slug = z.string().min(1).max(60);

/** "שמירה כרעיון": kept in the profile, not counted. At most 20, the newest first. */
export async function toggleSavedIdea(ideaSlug: string, save: boolean): Promise<{ ok: boolean; saved: string[] }> {
  if (!slug.safeParse(ideaSlug).success) return { ok: false, saved: [] };
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("preferences").eq("user_id", user.id).maybeSingle();
  const prefs = ((data?.preferences as Record<string, unknown> | null) ?? {}) as { saved_ideas?: unknown };
  const before = Array.isArray(prefs.saved_ideas) ? prefs.saved_ideas.filter((x): x is string => typeof x === "string") : [];
  const saved = (save ? [ideaSlug, ...before.filter((x) => x !== ideaSlug)] : before.filter((x) => x !== ideaSlug)).slice(0, 20);
  const { error } = await supabase.from("profiles").update({ preferences: { ...prefs, saved_ideas: saved } }).eq("user_id", user.id);
  revalidatePath("/progress");
  return { ok: !error, saved };
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
  const { data } = await supabase.from("profiles").select("preferences").eq("user_id", user.id).maybeSingle();
  const prefs = (data?.preferences as Record<string, unknown> | null) ?? {};
  const [food, profile] = await Promise.all([
    supabase.from("food_preferences").upsert({ user_id: user.id, likes: t.likes, dislikes: t.dislikes, allergies }),
    supabase.from("profiles").update({ preferences: { ...prefs, never_eat: t.never } }).eq("user_id", user.id),
  ]);
  if (food.error || profile.error) console.error("saveTaste failed", food.error?.message ?? profile.error?.message);
  revalidatePath("/profile");
  refresh();
  return { ok: !food.error && !profile.error };
}
