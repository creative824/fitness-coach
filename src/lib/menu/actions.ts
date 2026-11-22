"use server";

import { z } from "zod";
import { loadDayContext } from "@/lib/day/context";
import { syncMealTask } from "@/lib/day/tasks";
import { requireUser } from "@/lib/data/user";
import { foodItemSchema, totalsOf } from "@/lib/food/items";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { renderSlot, reshuffle, swapSlot, type DayMenu, type SlotType } from "./engine";
import { loadDayLog } from "./data";
import { toView, type MenuView } from "./view";

export type MenuResult = { ok: true; menu: MenuView; eatenKcal: number } | { ok: false };

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
  return { ok: true, menu: toView(next, ctx.profile), eatenKcal: await eatenToday(user.id, date) };
}

/** Calories of today's confirmed food logs, middle of each range. */
async function eatenToday(userId: string, date: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("food_logs")
    .select("food_log_items(kcal_min, kcal_max, protein_g, carbs_g, fat_g)")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("status", "confirmed");
  const items = (data ?? []).flatMap((r) => (r as { food_log_items: Parameters<typeof totalsOf>[0] }).food_log_items ?? []);
  const t = totalsOf(items.map((i) => ({ ...i, kcal_min: i.kcal_min === null ? null : Number(i.kcal_min), kcal_max: i.kcal_max === null ? null : Number(i.kcal_max) })));
  return t.kcal ? Math.round((t.kcal[0] + t.kcal[1]) / 2) : 0;
}

const index = z.int().min(0).max(7);

export async function swapMeal(i: number): Promise<MenuResult> {
  if (!index.safeParse(i).success) return { ok: false };
  return withMenu(async (menu, ctx) => swapSlot(menu, i, ctx.profile));
}

export async function swapWholeMenu(): Promise<MenuResult> {
  return withMenu(async (menu, ctx) =>
    reshuffle(menu, { target: menu.target, mealsPerDay: ctx.mealsPerDay, profile: ctx.profile }, Math.floor(Math.random() * 2 ** 31)),
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
    const items = d.items.map((it) => (numbers ? it : { ...it, kcal_min: null, kcal_max: null, protein_g: null, carbs_g: null, fat_g: null, confidence: null }));
    const { minutes } = localDay(new Date());
    const mealType = slot ? FOOD_MEAL[slot.type] : minutes < 11 * 60 ? "breakfast" : minutes < 16 * 60 ? "lunch" : minutes >= 18 * 60 ? "dinner" : "snack";
    const { data, error } = await supabase.rpc("save_food_log", {
      p_date: date,
      p_meal_type: mealType,
      p_text: d.text,
      p_status: "confirmed",
      p_source: "web",
      p_client_ref: d.clientRef,
      p_estimated: d.estimated && numbers,
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
