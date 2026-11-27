/**
 * The food diary of one day ("יום האוכל שלי"): meals in the order of the day, a quick way to
 * change an amount, and the end-of-day summary. Pure: used on the server and in the browser.
 */
import type { FoodItem, FoodTotals, MealType } from "./items";
import { totalsOf } from "./items";
import { relabel } from "./parse";

/** Sections of the day, in order. A between-meal snack before 15:00 sits before lunch. */
export const SECTIONS = [
  ["breakfast", "ארוחת בוקר"],
  ["midmorning", "ארוחת ביניים"],
  ["lunch", "ארוחת צהריים"],
  ["afternoon", "ארוחת ביניים נוספת"],
  ["dinner", "ארוחת ערב"],
  ["nibbles", "נשנושים"],
] as const;
export type Section = (typeof SECTIONS)[number][0];
export const SECTION_LABEL = Object.fromEntries(SECTIONS) as Record<Section, string>;

const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jerusalem" });

/** "13:30", Israel time. */
export const clockOf = (iso: string) => hourFmt.format(new Date(iso));
const hourOf = (iso: string) => Number(clockOf(iso).slice(0, 2));

export function sectionOf(mealType: MealType | null, loggedAt: string): Section {
  const h = hourOf(loggedAt);
  if (mealType === "breakfast" || mealType === "lunch" || mealType === "dinner") return mealType;
  if (mealType === "snack") return h < 15 ? "midmorning" : "afternoon";
  if (mealType === "nibble") return "nibbles";
  // "Another meal" or no kind: by the hour.
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "nibbles";
}

/** The title of a meal card: its section, or "ארוחה" for a meal filed as "another meal". */
export function titleOf(mealType: MealType | null, loggedAt: string): string {
  if (mealType === "other") return "ארוחה";
  return SECTION_LABEL[sectionOf(mealType, loggedAt)];
}

export interface DiaryMeal {
  id: string;
  mealType: MealType | null;
  text: string;
  loggedAt: string;
  status: "draft" | "confirmed";
  items: FoodItem[];
}

const ORDER = new Map(SECTIONS.map(([k], i) => [k, i]));

/** Meals sorted by the order of the day, then by time. */
export function orderMeals<T extends Pick<DiaryMeal, "mealType" | "loggedAt">>(meals: T[]): T[] {
  return [...meals].sort((a, b) => {
    const d = ORDER.get(sectionOf(a.mealType, a.loggedAt))! - ORDER.get(sectionOf(b.mealType, b.loggedAt))!;
    return d || a.loggedAt.localeCompare(b.loggedAt);
  });
}

/** One number for a range: its middle. */
export const kcalMid = (i: Pick<FoodItem, "kcal_min" | "kcal_max">) =>
  i.kcal_min === null || i.kcal_max === null ? 0 : Math.round((i.kcal_min + i.kcal_max) / 2);
export const mid = (r: [number, number] | null | undefined) => (r ? Math.round((r[0] + r[1]) / 2) : 0);

/** A short line of what was eaten: "חזה עוף, אורז וסלט". */
export function foodsLine(items: Pick<FoodItem, "item_name">[], max = 4): string {
  const names = items.map((i) => i.item_name.replace(/\s*\(.*?\)\s*/g, " ").trim()).filter(Boolean);
  if (!names.length) return "";
  const shown = names.slice(0, max);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(", ")} ועוד ${more}`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} ו${shown.at(-1)}`;
}

// ───────────────────────── changing an amount ─────────────────────────

/** Scales every number of an item, e.g. 2 eggs → 3 eggs is a factor of 1.5. */
export function scaleItem(item: FoodItem, factor: number): FoodItem {
  const f = Math.max(0.05, factor);
  const r1 = (v: number | null) => (v === null ? null : Math.round(v * f * 10) / 10);
  const r0 = (v: number | null) => (v === null ? null : Math.round(v * f));
  const quantity = item.quantity === null ? null : Math.round(item.quantity * f * 100) / 100;
  let unit = item.unit;
  if (unit && quantity !== null) {
    // "2 פרוסות (64 ג׳)" → "3 פרוסות (96 ג׳)".
    unit = unit.replace(/\((\d+) (ג׳|מ״ל)\)/, (_, g: string, u: string) => `(${Math.round(Number(g) * f)} ${u})`);
    if (item.quantity !== null && quantity > 1 !== item.quantity > 1) unit = relabel(unit, quantity);
  }
  return {
    ...item,
    quantity,
    unit,
    kcal_min: r0(item.kcal_min),
    kcal_max: r0(item.kcal_max),
    protein_g: r1(item.protein_g),
    carbs_g: r1(item.carbs_g),
    fat_g: r1(item.fat_g),
  };
}

const WEIGHT_UNITS = new Set(["g", "ml", "גרם", "מ״ל", "מל"]);
const HALF_UNITS = /^(כוס|כוסות|קערה|קערות|צלחת|צלחות|מנה|מנות|שקית|חפיסה)/;

/** How much one tap on − / + changes an item: a slice, half a portion, or a quarter of the grams. */
export function stepOf(item: Pick<FoodItem, "quantity" | "unit">): number {
  const q = item.quantity;
  if (q === null) return 0.5;
  if (item.unit && WEIGHT_UNITS.has(item.unit)) return q >= 200 ? 50 : 25;
  if (item.unit && HALF_UNITS.test(item.unit)) return 0.5;
  return q <= 1 || q % 1 !== 0 ? 0.5 : 1;
}

/**
 * Amounts are changed as a factor of the item as it was understood: one tap on − / + moves the
 * factor by one step of the item's unit (a slice, an egg, a quarter of the grams), or by half a
 * portion when the item has no amount. Returns null when it would drop to nothing.
 */
export function nextFactor(base: Pick<FoodItem, "quantity" | "unit">, factor: number, dir: 1 | -1): number | null {
  const step = base.quantity ? stepOf(base) / base.quantity : 0.5;
  const next = Math.round((factor + dir * step) * 1000) / 1000;
  return next <= 0.01 ? null : next;
}

/** "חצי מנה" / "פי 2" for an item without an amount that was changed, else null. */
export function portionNote(base: Pick<FoodItem, "quantity">, factor: number): string | null {
  if (base.quantity !== null || factor === 1) return null;
  return factor === 0.5 ? "חצי מנה" : `פי ${Math.round(factor * 10) / 10}`;
}

// ───────────────────────── end of day ─────────────────────────

export interface DaySummary {
  meals: number;
  kcal: number;
  protein: number;
  target: number | null;
  proteinTarget: number | null;
  /** Calories left (negative: over). */
  left: number | null;
  richest: { title: string; protein: number } | null;
  calorieGoal: "under" | "on" | "over" | null;
  proteinGoal: boolean | null;
  insight: string | null;
}

export function summarize(meals: DiaryMeal[], target: number | null, proteinTarget: number | null, opts: { finished: boolean } = { finished: false }): DaySummary {
  const counted = meals.filter((m) => m.status === "confirmed");
  const t: FoodTotals = totalsOf(counted.flatMap((m) => m.items));
  const kcal = mid(t.kcal);
  const protein = t.protein ?? 0;
  let richest: DaySummary["richest"] = null;
  for (const m of counted) {
    const p = Math.round(m.items.reduce((a, i) => a + (i.protein_g ?? 0), 0));
    if (p > 0 && (!richest || p > richest.protein)) richest = { title: titleOf(m.mealType, m.loggedAt), protein: p };
  }
  const calorieGoal = target ? (kcal > target * 1.1 ? "over" : kcal >= target * 0.8 ? "on" : "under") : null;
  const proteinGoal = proteinTarget ? protein >= proteinTarget * 0.9 : null;
  return {
    meals: counted.length,
    kcal,
    protein,
    target,
    proteinTarget,
    left: target ? target - kcal : null,
    richest,
    calorieGoal,
    proteinGoal,
    insight: insightFor({ kcal, protein, target, proteinTarget, meals: counted, finished: opts.finished }),
  };
}

/** One short, kind line about the day. Never praises eating less than the plan. */
export function insightFor({
  kcal,
  protein,
  target,
  proteinTarget,
  meals,
  finished,
}: {
  kcal: number;
  protein: number;
  target: number | null;
  proteinTarget: number | null;
  meals: DiaryMeal[];
  finished: boolean;
}): string | null {
  if (!meals.length) return null;
  if (proteinTarget && protein > 0) {
    const share = Math.round((protein / proteinTarget) * 100);
    if (share >= 90) return `היום הגעת ל-${Math.min(share, 999)}% מיעד החלבון שלך.`;
    const breakfast = meals.some((m) => m.mealType === "breakfast" && m.items.reduce((a, i) => a + (i.protein_g ?? 0), 0) >= 15);
    if (finished) {
      return breakfast
        ? `היום הגעת ל-${share}% מיעד החלבון. מחר כדאי להוסיף מקור חלבון גם לצהריים.`
        : "היום צרכת פחות חלבון מהיעד. מחר כדאי לשלב מקור חלבון כבר בארוחת הבוקר.";
    }
    const missing = Math.round(proteinTarget - protein);
    return `חסרים עוד ${missing} גרם חלבון להיום. ביצים, עוף, טונה או יוגורט חלבון יסגרו את הפער.`;
  }
  if (target) {
    if (kcal > target * 1.1) return "היום עברת מעט את היעד. זה קורה, מחר ממשיכים כרגיל.";
    if (kcal >= target * 0.8) return "היום היית בטווח היעד הקלורי שלך.";
  }
  return null;
}

// ───────────────────────── reading the text ─────────────────────────

const SALAD_VEG = new Set(["tomato", "cucumber", "pepper", "carrot", "lettuce", "onion", "cabbage", "veg"]);

/**
 * "סלט עם מלפפון ועגבנייה" is one salad, not a salad plus a cucumber plus a tomato: raw
 * vegetables right after a salad (when the text says the salad was "with" them) are its parts.
 */
export function foldSalad<T extends { foodId: string }>(text: string, items: T[]): T[] {
  if (!/סלט[^,.]{0,12}\s(עם|של)\s/.test(text)) return items;
  const out: T[] = [];
  let inSalad = false;
  for (const it of items) {
    if (it.foodId === "salad" || it.foodId === "salad_oil") {
      inSalad = true;
      out.push(it);
      continue;
    }
    if (inSalad && SALAD_VEG.has(it.foodId)) continue;
    inSalad = false;
    out.push(it);
  }
  return out;
}

const fmtQty = (q: number) => {
  const r = Math.round(q * 100) / 100;
  if (r === 0.5) return "חצי";
  if (r % 1 === 0.5) return `${Math.floor(r)}½`;
  return String(r);
};

/**
 * How a food reads in the diary: "2 ביצים", "2 פרוסות לחם מלא", "150 גרם אורז", "חצי פיתה".
 * The grams in brackets and the word "יחידות" are left out (the calories are beside it).
 */
export function itemLabel(i: Pick<FoodItem, "item_name" | "quantity" | "unit">): string {
  if (!i.quantity) return i.item_name;
  const unit = (i.unit ?? "").replace(/\s*\(.*?\)\s*/g, "").trim();
  const q = fmtQty(i.quantity);
  if (!unit || unit === "יחידה" || unit === "יחידות") return i.quantity === 1 ? i.item_name : `${q} ${i.item_name}`;
  // "כף טחינה", "קערה סלט": one of a unit reads without the 1.
  return i.quantity === 1 ? `${unit} ${i.item_name}` : `${q} ${unit} ${i.item_name}`;
}
