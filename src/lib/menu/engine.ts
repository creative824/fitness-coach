/**
 * Daily menu engine. Pure functions, no I/O, so the server and the tests share them.
 *
 * - A day has 3–6 slots (breakfast, snacks, lunch, dinner). Each slot gets a share of the
 *   daily calorie target; the shares add up to the target.
 * - Each slot picks a meal from src/content/menu-meals.ts that fits the user's diet, allergies
 *   and dislikes, and scales its portions to the slot's calories. Rounding errors are carried to
 *   the next slot, so the day still adds up to the target (within a few dozen kcal).
 * - Swapping one meal keeps the slot's calories; swapping the whole menu keeps meals already
 *   eaten. The order of the options is fixed by the menu's seed, so "next option" is stable.
 */
import { FOODS, type FoodKey, type FoodTag, type MenuFood } from "@/content/menu-foods";
import { MENU_MEALS, type MenuMeal, type SlotType } from "@/content/menu-meals";

import { foodsFor } from "@/lib/food/prefs";

export type { SlotType } from "@/content/menu-meals";

export const SLOT_LABEL: Record<SlotType, string> = {
  breakfast: "ארוחת בוקר",
  snack: "ארוחת ביניים",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
};

/**
 * Slots and calorie shares (percent). Every day has the three meals and two between-meal
 * snacks (morning and afternoon); six meals a day adds an evening snack. Breakfast is the
 * lighter meal; the user can set any slot's calories by hand (`custom`).
 */
const LAYOUTS: Record<number, [SlotType, number][]> = {
  5: [["breakfast", 20], ["snack", 10], ["lunch", 35], ["snack", 10], ["dinner", 25]],
  6: [["breakfast", 20], ["snack", 10], ["lunch", 30], ["snack", 10], ["dinner", 20], ["snack", 10]],
};

export function layoutFor(mealsPerDay: number | null | undefined): [SlotType, number][] {
  return LAYOUTS[(mealsPerDay ?? 5) >= 6 ? 6 : 5];
}

/** "ארוחת ביניים · בוקר" etc.: a snack is named by the meal before it. */
export function slotLabels(types: SlotType[]): string[] {
  return types.map((t, i) => {
    if (t !== "snack") return SLOT_LABEL[t];
    const before = types.slice(0, i).reverse().find((x) => x !== "snack");
    const when = before === "breakfast" ? "בוקר" : before === "lunch" ? "אחה״צ" : before === "dinner" ? "ערב" : null;
    return when ? `ארוחת ביניים · ${when}` : SLOT_LABEL.snack;
  });
}

/** Matches the slots of an older menu to a layout by kind and order, so eaten meals stay put. */
export function alignToLayout(old: MenuSlot[], layout: [SlotType, number][]): (MenuSlot | undefined)[] {
  const used = new Set<number>();
  return layout.map(([type]) => {
    const k = old.findIndex((s, i) => !used.has(i) && s.type === type);
    if (k < 0) return undefined;
    used.add(k);
    return old[k];
  });
}

export interface DietProfile {
  pattern: string | null;
  allergies: string[];
  /** Dislikes and sensitivities, free text. A meal that names one is left out. */
  avoid: string[];
}

export interface EatenInfo {
  /** The food log written when the meal was marked eaten. */
  logId: string;
  /** Set when the user ate something else instead, from the free-text log. */
  custom?: { text: string; kcal: number | null };
}

export interface MenuSlot {
  type: SlotType;
  /** The calories planned for the slot. A swap keeps them. */
  kcal: number;
  meal: string;
  eaten?: EatenInfo | null;
}

export interface DayMenu {
  /** 2: the layout with between-meal snacks. Menus saved as 1 are rebuilt around what was eaten. */
  v: 1 | 2;
  target: number;
  seed: number;
  slots: MenuSlot[];
  /** Calories the user set by hand for some slots (by position in the layout), null for the rest. */
  custom?: (number | null)[];
}

// ───────────────────────── diet filter ─────────────────────────

const mealsBySlug = new Map(MENU_MEALS.map((m) => [m.slug, m]));
export const mealBySlug = (slug: string): MenuMeal | undefined => mealsBySlug.get(slug);

export function tagsOf(meal: MenuMeal): Set<FoodTag> {
  return new Set(meal.parts.flatMap((p) => FOODS[p.food].tags as FoodTag[]));
}

export function allowedFor(profile: DietProfile): (meal: MenuMeal) => boolean {
  const block = new Set<string>(profile.allergies.filter((a) => a !== "shellfish"));
  const p = profile.pattern;
  if (p === "vegan") ["egg", "milk", "meat", "fish"].forEach((t) => block.add(t));
  if (p === "vegetarian") ["meat", "fish"].forEach((t) => block.add(t));
  if (p === "pescatarian") block.add("meat");
  const avoid = profile.avoid.map((x) => x.trim()).filter((x) => x.length >= 2);
  // "דגים" stands for salmon and white fish, "גבינות" for every cheese (see food/prefs.ts).
  const blocked = new Set(avoid.flatMap(foodsFor));
  return (meal) => {
    for (const t of tagsOf(meal)) if (block.has(t)) return false;
    if (meal.parts.some((p) => !p.fixed && blocked.has(p.food))) return false;
    const words = [meal.title, ...meal.parts.map((x) => FOODS[x.food].name)];
    return !avoid.some((a) => words.some((w) => w.includes(a)));
  };
}

// ───────────────────────── scaling ─────────────────────────

const MIN_SCALE = 0.55;
const MAX_SCALE = 1.9;

function baseKcal(meal: MenuMeal) {
  let fixed = 0;
  let scalable = 0;
  for (const part of meal.parts) {
    const k = FOODS[part.food].kcal * part.qty;
    if (part.fixed) fixed += k;
    else scalable += k;
  }
  return { fixed, scalable };
}

export function scaleFor(meal: MenuMeal, target: number): number {
  const { fixed, scalable } = baseKcal(meal);
  return scalable > 0 ? (target - fixed) / scalable : 1;
}

const fits = (meal: MenuMeal, target: number) => {
  const s = scaleFor(meal, target);
  return s >= MIN_SCALE && s <= MAX_SCALE;
};

/** Portions close to how the meal is written: a light slot gets light meals first, not shrunk big ones. */
const natural = (meal: MenuMeal, target: number) => {
  const s = scaleFor(meal, target);
  return s >= 0.7 && s <= 1.45;
};

export interface RenderedItem {
  food: FoodKey;
  name: string;
  /** The number: "2", "150", "½". The unit is part of the name ("גרם אורז מבושל"). */
  amount: string;
  hint: string | null;
  qty: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RenderedMeal {
  slug: string;
  title: string;
  tip: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  items: RenderedItem[];
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function fraction(q: number): string {
  const whole = Math.floor(q);
  const half = q - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}

function describe(food: MenuFood, qty: number): { amount: string; name: string; hint: string | null } {
  const hint = food.hint?.(qty) ?? null;
  if (food.unit.kind === "pc") {
    const many = qty > 1;
    return { amount: fraction(qty), name: many ? food.unit.many : food.unit.one, hint };
  }
  return { amount: String(qty), name: `${food.unit.kind === "ml" ? "מ״ל" : "גרם"} ${food.name}`, hint };
}

/** Portions of one meal scaled to `target` kcal, rounded to household amounts. */
export function renderMeal(meal: MenuMeal, target: number): RenderedMeal {
  const s = clamp(scaleFor(meal, target), MIN_SCALE, MAX_SCALE);
  const qty = meal.parts.map((p) => {
    const f: MenuFood = FOODS[p.food];
    return p.fixed ? p.qty : clamp(roundTo(p.qty * s, f.step), f.min, f.max);
  });
  const total = () => meal.parts.reduce((sum, p, i) => sum + FOODS[p.food].kcal * qty[i], 0);

  // Fine-tune: move one portion by one step while it brings the meal closer to the target.
  for (let n = 0; n < 8; n++) {
    const diff = target - total();
    if (Math.abs(diff) < 15) break;
    let best = -1;
    let bestGain = 0;
    let bestQty = 0;
    meal.parts.forEach((p, i) => {
      if (p.fixed) return;
      const f: MenuFood = FOODS[p.food];
      const next = qty[i] + Math.sign(diff) * f.step;
      if (next < f.min || next > f.max) return;
      const gain = Math.abs(diff) - Math.abs(diff - Math.sign(diff) * f.step * f.kcal);
      if (gain > bestGain) {
        best = i;
        bestGain = gain;
        bestQty = next;
      }
    });
    if (best < 0) break;
    qty[best] = bestQty;
  }

  const items: RenderedItem[] = meal.parts.map((p, i) => {
    const f: MenuFood = FOODS[p.food];
    const q = Math.round(qty[i] * 100) / 100;
    return {
      food: p.food,
      ...describe(f, q),
      qty: q,
      kcal: Math.round(f.kcal * q),
      protein: Math.round(f.p * q * 10) / 10,
      carbs: Math.round(f.c * q * 10) / 10,
      fat: Math.round(f.f * q * 10) / 10,
    };
  });
  const sum = (k: "kcal" | "protein" | "carbs" | "fat") => Math.round(items.reduce((a, x) => a + x[k], 0));
  return {
    slug: meal.slug,
    title: meal.title,
    tip: meal.tip ?? null,
    kcal: sum("kcal"),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
    items,
  };
}

export function renderSlot(slot: MenuSlot): RenderedMeal | null {
  const meal = mealBySlug(slot.meal);
  return meal ? renderMeal(meal, slot.kcal) : null;
}

/** Calories of a slot as it stands: what was eaten instead, or the meal's portions. */
export function slotKcal(slot: MenuSlot): number {
  if (slot.eaten?.custom) return slot.eaten.custom.kcal ?? 0;
  return renderSlot(slot)?.kcal ?? slot.kcal;
}

// ───────────────────────── options ─────────────────────────

/** Small deterministic PRNG (mulberry32), so a seed always gives the same order. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(xs: T[], seed: number): T[] {
  const r = rng(seed);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Every meal that can fill slot `index` at `kcal`, in this menu's fixed order. */
export function optionsFor(type: SlotType, kcal: number, index: number, seed: number, profile: DietProfile): MenuMeal[] {
  const ok = allowedFor(profile);
  const own = MENU_MEALS.filter((m) => m.slots.includes(type) && ok(m));
  let list = own.filter((m) => fits(m, kcal));
  if (!own.length) list = MENU_MEALS.filter(ok);
  const order = shuffled(list, seed * 31 + index * 7919);
  const out = [...order.filter((m) => natural(m, kcal)), ...order.filter((m) => !natural(m, kcal))];
  // Unusual targets or strict diets: add the closest of the slot's other meals, so there is
  // always something new to swap to.
  if (out.length < 4) {
    const gap = (m: MenuMeal) => Math.abs(Math.log(Math.max(0.01, scaleFor(m, kcal))));
    out.push(...own.filter((m) => !out.includes(m)).sort((x, y) => gap(x) - gap(y)));
  }
  return out;
}

export interface MealChoice {
  slug: string;
  title: string;
  kcal: number;
  protein: number;
  light: boolean;
  /** Short preview of the portions: "2 ביצים · 2 פרוסות לחם מלא". */
  portions: string;
}

/**
 * Every meal of the slot's kind that suits the diet, scaled to the slot's calories, for the
 * "all options" list. The ones that fit the calories come first, closest to their written portions.
 */
export function choicesFor(menu: DayMenu, index: number, profile: DietProfile): MealChoice[] {
  const slot = menu.slots[index];
  if (!slot) return [];
  const ok = allowedFor(profile);
  const first = optionsFor(slot.type, slot.kcal, index, menu.seed, profile);
  const rest = MENU_MEALS.filter((m) => m.slots.includes(slot.type) && ok(m) && !first.includes(m));
  // Closest to the portions as written first: a light slot lists the light meals at the top.
  const gap = (m: MenuMeal) => Math.abs(Math.log(Math.max(0.01, scaleFor(m, slot.kcal))));
  const fitting = first.filter((m) => fits(m, slot.kcal)).sort((x, y) => gap(x) - gap(y));
  return [...fitting, ...first.filter((m) => !fitting.includes(m)), ...rest].map((m) => {
    const r = renderMeal(m, slot.kcal);
    return {
      slug: m.slug,
      title: m.title,
      kcal: r.kcal,
      protein: r.protein,
      light: Boolean(m.light),
      portions: r.items.map((x) => `${x.amount} ${x.name}`).join(" · "),
    };
  });
}

/** Puts a chosen meal in a slot, at the slot's calories. */
export function chooseSlot(menu: DayMenu, index: number, slug: string, profile: DietProfile): DayMenu {
  const slot = menu.slots[index];
  const meal = mealBySlug(slug);
  if (!slot || slot.eaten || !meal || !meal.slots.includes(slot.type) || !allowedFor(profile)(meal)) return menu;
  return { ...menu, slots: menu.slots.map((s, i) => (i === index ? { ...s, meal: slug } : s)) };
}

export interface BuildInput {
  target: number;
  mealsPerDay: number | null;
  profile: DietProfile;
  seed: number;
  /** Slots of an earlier version of the day. Eaten ones are kept as they are. */
  keep?: (MenuSlot | undefined)[];
  /** Calories set by hand per slot of the layout (null: by the usual share). */
  custom?: (number | null)[] | null;
}

/** Hand-set calories that match the layout, or null. Values are kept within 80–1500. */
export function customFor(custom: (number | null)[] | null | undefined, mealsPerDay: number | null): (number | null)[] | null {
  const n = layoutFor(mealsPerDay).length;
  if (!custom || custom.length !== n || custom.every((x) => x === null)) return null;
  return custom.map((x) => (typeof x === "number" && Number.isFinite(x) ? Math.min(1500, Math.max(80, Math.round(x / 10) * 10)) : null));
}

/** Planned calories per slot: hand-set ones as set, the rest share what is left of the target. */
export function plannedKcal(target: number, mealsPerDay: number | null, custom?: (number | null)[] | null): number[] {
  const layout = layoutFor(mealsPerDay);
  const c = customFor(custom, mealsPerDay);
  const fixed = c ? c.reduce<number>((a, x) => a + (x ?? 0), 0) : 0;
  const shareLeft = layout.reduce((a, [, x], i) => a + (c?.[i] != null ? 0 : x), 0);
  const left = Math.max(0, target - fixed);
  return layout.map(([, share], i) => (c?.[i] != null ? c[i]! : shareLeft ? Math.max(80, Math.round((left * share) / shareLeft)) : 80));
}

export function buildMenu({ target, mealsPerDay, profile, seed, keep = [], custom }: BuildInput): DayMenu {
  const layout = layoutFor(mealsPerDay);
  const hand = customFor(custom, mealsPerDay);
  const plan = plannedKcal(target, mealsPerDay, hand);
  // A meal, or its main food (the first part), appears once a day.
  const used = new Set<string>();
  const use = (slug: string) => {
    used.add(slug);
    const main = mealBySlug(slug)?.parts[0]?.food;
    if (main) used.add(`food:${main}`);
  };
  const isUsed = (m: MenuMeal) => used.has(m.slug) || used.has(`food:${m.parts[0]?.food}`);
  keep.forEach((k) => k?.eaten && use(k.meal));

  let carry = 0;
  const slots: MenuSlot[] = layout.map(([type], i) => {
    const kept = keep[i];
    const planned = plan[i];
    if (kept?.eaten && kept.type === type) {
      carry += planned - slotKcal(kept);
      return kept;
    }
    // A hand-set slot keeps its number; rounding is carried to the next free slot.
    const kcal = hand?.[i] != null ? planned : Math.max(80, planned + carry);
    const options = optionsFor(type, kcal, i, seed, profile);
    const meal = options.find((m) => !isUsed(m)) ?? options.find((m) => !used.has(m.slug)) ?? options[0];
    if (!meal) return { type, kcal, meal: "" };
    use(meal.slug);
    const actual = renderMeal(meal, kcal).kcal;
    carry = (hand?.[i] != null ? carry : 0) + kcal - actual;
    return { type, kcal, meal: meal.slug, eaten: null };
  });
  const out: DayMenu = { v: 2, target, seed, slots: slots.filter((s) => s.meal) };
  if (hand) out.custom = hand;
  return out;
}

/** The next option for one slot, at the same calories. Meals used elsewhere today are skipped. */
export function swapSlot(menu: DayMenu, index: number, profile: DietProfile): DayMenu {
  const slot = menu.slots[index];
  if (!slot || slot.eaten) return menu;
  const options = optionsFor(slot.type, slot.kcal, index, menu.seed, profile);
  if (options.length < 2) return menu;
  const others = new Set(menu.slots.filter((_, i) => i !== index).map((s) => s.meal));
  const at = options.findIndex((m) => m.slug === slot.meal);
  for (let k = 1; k <= options.length; k++) {
    const next = options[(at + k + options.length) % options.length];
    if (next.slug !== slot.meal && !others.has(next.slug)) {
      return { ...menu, slots: menu.slots.map((s, i) => (i === index ? { ...s, meal: next.slug } : s)) };
    }
  }
  return menu;
}

/** "Option 3 of 9" for a slot. */
export function optionPosition(menu: DayMenu, index: number, profile: DietProfile): { at: number; of: number } {
  const slot = menu.slots[index];
  const options = optionsFor(slot.type, slot.kcal, index, menu.seed, profile);
  return { at: Math.max(0, options.findIndex((m) => m.slug === slot.meal)) + 1, of: options.length };
}

/** A new menu for the day, keeping what was already eaten. */
export function reshuffle(menu: DayMenu, input: Omit<BuildInput, "seed" | "keep">, seed: number): DayMenu {
  return buildMenu({ ...input, seed, keep: alignToLayout(menu.slots, layoutFor(input.mealsPerDay)) });
}

/**
 * A menu saved before snacks were part of every day, or for an older calorie target, rebuilt
 * around the meals already eaten.
 */
export function upgradeMenu(menu: DayMenu, input: Omit<BuildInput, "seed" | "keep">): DayMenu {
  const same = JSON.stringify(menu.custom ?? null) === JSON.stringify(customFor(input.custom, input.mealsPerDay));
  if (menu.v === 2 && same && menu.target === input.target && menu.slots.length === layoutFor(input.mealsPerDay).length) return menu;
  return reshuffle(menu, input, menu.seed);
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
