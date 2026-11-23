"use server";

import { z } from "zod";
import { loadDayContext } from "@/lib/day/context";
import { syncMealTask } from "@/lib/day/tasks";
import { requireUser } from "@/lib/data/user";
import { loadFoodDay } from "@/lib/food/data";
import { estimateText } from "@/lib/food/estimate-text";
import { foodItemSchema, totalsOf } from "@/lib/food/items";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { chooseSlot, customFor, layoutFor, renderSlot, reshuffle, swapSlot, type DayMenu, type SlotType } from "./engine";
import { loadDayLog } from "./data";
import { toView, type MenuView } from "./view";

export type MenuResult = { ok: true; menu: MenuView; eatenKcal: number; eatenProtein: number } | { ok: false };

const FOOD_MEAL: Record<SlotType, "breakfast" | "lunch" | "dinner" | "snack"> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

/** Loads today's menu, applies `change`, saves it and returns the new view. */
async function withMenu(change: (menu: DayMenu, ctx: Awaited<ReturnType<typeof loadDayContext>>, userId: string, date: string) => Promise<DayMenu | null>): Promise<MenuResult> {
  const user = await requireUser();
  const date = localDay(new Date()).date;
  const [ctx, day] = await Promise.all([loadDayContext(user.id), loadDayLog(user.id, date)]);
  if (!day.saved) return { ok: false };
  const next = await change(day.menu, ctx, user.id, date);
  if (!next) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("day_logs").update({ menu: next }).eq("user_id", user.id).eq("date", date);
  if (error) {
    console.error("menu save failed", error.message);
    return { ok: false };
  }
  const eaten = await eatenToday(user.id, date);
  return { ok: true, menu: toView(next, ctx.profile), eatenKcal: eaten.kcal, eatenProtein: eaten.protein };
}

/** Calories (middle of each range) and protein of today's confirmed food logs (meals saved without numbers are counted from their text). */
async function eatenToday(userId: string, date: string): Promise<{ kcal: number; protein: number }> {
  const day = await loadFoodDay(userId, date).catch(() => null);
  const k = day?.totals.kcal;
  return { kcal: k ? Math.round((k[0] + k[1]) / 2) : 0, protein: day?.totals.protein ?? 0 };
}

const index = z.int().min(0).max(7);

export async function swapMeal(i: number): Promise<MenuResult> {
  if (!index.safeParse(i).success) return { ok: false };
  return withMenu(async (menu, ctx) => swapSlot(menu, i, ctx.profile));
}

/** Puts a meal picked from the full list in a slot. */
export async function chooseMeal(i: number, slug: string): Promise<MenuResult> {
  if (!index.safeParse(i).success || typeof slug !== "string" || slug.length > 60) return { ok: false };
  return withMenu(async (menu, ctx) => chooseSlot(menu, i, slug, ctx.profile));
}

/**
 * Sets roughly how many calories a meal of the day should have (null: back to the usual share).
 * Kept in the profile, so every next day follows it; today's menu is rebuilt around it, keeping
 * what was already eaten. The other meals share what is left of the daily target.
 */
export async function setSlotKcal(i: number, kcal: number | null): Promise<MenuResult> {
  if (!index.safeParse(i).success || (kcal !== null && !(Number.isFinite(kcal) && kcal >= 80 && kcal <= 1500))) return { ok: false };
  const user = await requireUser();
  const ctx = await loadDayContext(user.id);
  const n = layoutFor(ctx.mealsPerDay).length;
  if (i >= n) return { ok: false };
  const list: (number | null)[] = Array.from({ length: n }, (_, k) => (ctx.slotKcal?.length === n ? (ctx.slotKcal[k] ?? null) : null));
  list[i] = kcal;
  // At least one meal keeps the usual share, so the day still adds up to the target.
  if (list.every((x) => x !== null)) return { ok: false };
  const custom = customFor(list, ctx.mealsPerDay);
  const supabase = await createClient();
  const { data: row } = await supabase.from("profiles").select("preferences").eq("user_id", user.id).maybeSingle();
  const preferences = { ...((row?.preferences as Record<string, unknown> | null) ?? {}), slot_kcal: custom };
  const { error } = await supabase.from("profiles").update({ preferences }).eq("user_id", user.id);
  if (error) {
    console.error("slot kcal save failed", error.message);
    return { ok: false };
  }
  return withMenu(async (menu) => reshuffle(menu, { target: menu.target, mealsPerDay: ctx.mealsPerDay, profile: ctx.profile, custom }, menu.seed));
}

export async function swapWholeMenu(): Promise<MenuResult> {
  return withMenu(async (menu, ctx) =>
    reshuffle(menu, { target: menu.target, mealsPerDay: ctx.mealsPerDay, profile: ctx.profile, custom: ctx.slotKcal }, Math.floor(Math.random() * 2 ** 31)),
  );
}

const nthOfType = (menu: DayMenu, i: number) => menu.slots.slice(0, i).filter((s) => s.type === menu.slots[i].type).length;

/** Marks a menu meal eaten (writes a food log with its portions) or takes that back. */
export async function setMealEaten(i: number, eaten: boolean): Promise<MenuResult> {
  if (!index.safeParse(i).success || typeof eaten !== "boolean") return { ok: false };
  return withMenu(async (menu, ctx, userId, date) => {
    const slot = menu.slots[i];
    if (!slot || Boolean(slot.eaten) === eaten) return menu;
    const supabase = await createClient();
    let next: DayMenu;
    if (eaten) {
      const meal = renderSlot(slot);
      if (!meal) return null;
      const numbers = ctx.showNumbers;
      const { data, error } = await supabase.rpc("save_food_log", {
        p_date: date,
        p_meal_type: FOOD_MEAL[slot.type],
        p_text: `${meal.title} (מהתפריט)`,
        p_status: "confirmed",
        p_source: "web",
        p_client_ref: null,
        p_estimated: false,
        p_items: meal.items.map((it) => ({
          item_name: it.name,
          quantity: it.qty,
          unit: null,
          preparation: null,
          kcal_min: numbers ? it.kcal : null,
          kcal_max: numbers ? it.kcal : null,
          protein_g: numbers ? it.protein : null,
          carbs_g: numbers ? it.carbs : null,
          fat_g: numbers ? it.fat : null,
          confidence: numbers ? "medium" : null,
        })),
      });
      if (error) {
        console.error("menu eaten log failed", error.message);
        return null;
      }
      next = { ...menu, slots: menu.slots.map((s, k) => (k === i ? { ...s, eaten: { logId: data as string } } : s)) };
    } else {
      const logId = slot.eaten?.logId;
      if (logId) await supabase.from("food_logs").delete().eq("id", logId).eq("user_id", userId);
      next = { ...menu, slots: menu.slots.map((s, k) => (k === i ? { ...s, eaten: null } : s)) };
    }
    await syncMealTask(supabase, userId, date, slot.type, nthOfType(menu, i), eaten);
    return next;
  });
}

const otherSchema = z.object({
  text: z.string().trim().min(2).max(1000),
  items: z.array(foodItemSchema).max(30),
  estimated: z.boolean(),
  /** The menu slot this replaces, or null for something eaten on top of the menu. */
  slot: index.nullable(),
  clientRef: z.uuid(),
});

/** Free-text "what I ate" saved to the food log, optionally instead of a menu meal. */
export async function logOtherFood(input: z.input<typeof otherSchema>): Promise<MenuResult> {
  const parsed = otherSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const d = parsed.data;
  return withMenu(async (menu, ctx, userId, date) => {
    const supabase = await createClient();
    const slot = d.slot === null ? null : menu.slots[d.slot];
    if (slot?.eaten) return null;
    const numbers = ctx.showNumbers;
    const counted = d.items.length || !numbers ? d.items : (await estimateText(d.text, async () => false)).items;
    const items = counted.map((it) => (numbers ? it : { ...it, kcal_min: null, kcal_max: null, protein_g: null, carbs_g: null, fat_g: null, confidence: null }));
    const { minutes } = localDay(new Date());
    const mealType = slot ? FOOD_MEAL[slot.type] : minutes < 11 * 60 ? "breakfast" : minutes < 16 * 60 ? "lunch" : minutes >= 18 * 60 ? "dinner" : "snack";
    const { data, error } = await supabase.rpc("save_food_log", {
      p_date: date,
      p_meal_type: mealType,
      p_text: d.text,
      p_status: "confirmed",
      p_source: "web",
      p_client_ref: d.clientRef,
      p_estimated: (d.estimated || counted !== d.items) && numbers,
      p_items: items,
    });
    if (error) {
      console.error("other food log failed", error.message);
      return null;
    }
    if (!slot || d.slot === null) return menu;
    const t = totalsOf(items);
    const kcal = t.kcal ? Math.round((t.kcal[0] + t.kcal[1]) / 2) : null;
    await syncMealTask(supabase, userId, date, slot.type, nthOfType(menu, d.slot), true);
    return {
      ...menu,
      slots: menu.slots.map((s, k) => (k === d.slot ? { ...s, eaten: { logId: data as string, custom: { text: d.text.slice(0, 120), kcal } } } : s)),
    };
  });
}
