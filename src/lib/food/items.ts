import { z } from "zod";

/**
 * Food log items (follow-up spec §7). Every value is an estimate and is kept as a range;
 * nothing here is presented as exact, and nothing scores eating less.
 */

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  snack: "נשנוש",
};
export const CONFIDENCE_LABEL = { low: "ודאות נמוכה", medium: "ודאות בינונית", high: "ודאות גבוהה" } as const;
export type Confidence = keyof typeof CONFIDENCE_LABEL;

const num = (max: number) => z.coerce.number().finite().min(0).max(max);
const optNum = (max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), num(max).nullable());
const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || null : (v ?? null)), z.string().max(max).nullable());

export const foodItemSchema = z
  .object({
    item_name: z.string().trim().min(1).max(120),
    quantity: z.preprocess(
      (v) => (v === "" || v === undefined || v === 0 ? null : v),
      z.coerce.number().finite().positive().max(99999).nullable(),
    ),
    unit: optText(30),
    preparation: optText(60),
    kcal_min: optNum(5000),
    kcal_max: optNum(5000),
    protein_g: optNum(500),
    carbs_g: optNum(1000),
    fat_g: optNum(500),
    confidence: z.enum(["low", "medium", "high"]).nullable().default(null),
  })
  .transform((i) => {
    // A range is never upside down; a single number becomes a range of one.
    let lo = i.kcal_min === null ? null : Math.round(i.kcal_min);
    let hi = i.kcal_max === null ? null : Math.round(i.kcal_max);
    if (lo === null && hi !== null) lo = hi;
    if (hi === null && lo !== null) hi = lo;
    if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
    const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
    return { ...i, kcal_min: lo, kcal_max: hi, protein_g: r1(i.protein_g), carbs_g: r1(i.carbs_g), fat_g: r1(i.fat_g) };
  });
export type FoodItem = z.output<typeof foodItemSchema>;
export type FoodItemInput = z.input<typeof foodItemSchema>;

export const saveFoodSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  mealType: z.enum(MEAL_TYPES).nullable(),
  status: z.enum(["draft", "confirmed"]),
  clientRef: z.uuid(),
  estimated: z.boolean(),
  items: z.array(foodItemSchema).max(30),
});

export interface FoodTotals {
  kcal: [number, number] | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Items without a calorie estimate are not counted in the range. */
  missing: number;
}

export function totalsOf(items: Pick<FoodItem, "kcal_min" | "kcal_max" | "protein_g" | "carbs_g" | "fat_g">[]): FoodTotals {
  let lo = 0;
  let hi = 0;
  let counted = 0;
  let missing = 0;
  const macro = { protein: 0, carbs: 0, fat: 0 };
  const seen = { protein: false, carbs: false, fat: false };
  for (const i of items) {
    if (i.kcal_min === null || i.kcal_max === null) missing++;
    else {
      lo += i.kcal_min;
      hi += i.kcal_max;
      counted++;
    }
    for (const [k, v] of [["protein", i.protein_g], ["carbs", i.carbs_g], ["fat", i.fat_g]] as const) {
      if (v !== null) {
        macro[k] += v;
        seen[k] = true;
      }
    }
  }
  const r = (v: number) => Math.round(v);
  return {
    kcal: counted ? [roundRange(lo, "down"), roundRange(hi, "up")] : null,
    protein: seen.protein ? r(macro.protein) : null,
    carbs: seen.carbs ? r(macro.carbs) : null,
    fat: seen.fat ? r(macro.fat) : null,
    missing,
  };
}

/** Totals are shown to the nearest 10, so they never read as a precise count. */
function roundRange(v: number, dir: "down" | "up") {
  return dir === "down" ? Math.floor(v / 10) * 10 : Math.ceil(v / 10) * 10;
}

/** Suggests the meal from the hour, the user can change it. */
export function mealTypeAt(minutes: number): MealType {
  if (minutes >= 4 * 60 && minutes < 11 * 60) return "breakfast";
  if (minutes >= 11 * 60 && minutes < 16 * 60) return "lunch";
  if (minutes >= 18 * 60 && minutes < 23 * 60) return "dinner";
  return "snack";
}
