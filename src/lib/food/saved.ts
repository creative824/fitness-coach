/**
 * The user's own recipes and regular foods (saved_foods), and finding them in what the user
 * wrote: "אכלתי 5 טראפלס" → five units of the saved truffles, counted from the saved values
 * per unit, without asking the AI again. Pure.
 */
import type { FoodItem } from "./items";
import { normalize } from "./parse";
import type { Accuracy, Nutrition, Per100, Understanding } from "./recipe";

export interface SavedFood {
  id: string;
  name: string;
  kind: "recipe" | "food";
  unitName: string | null;
  yieldUnits: number | null;
  perUnit: Nutrition;
  accuracy: Accuracy | null;
  /** What it takes to edit it again. */
  recipe: SavedRecipe | null;
}

export interface SavedRecipe {
  understanding: Understanding;
  answers: Record<string, number>;
  labels: Record<number, Per100>;
}

const isRange = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x < 100000);

export function nutritionOf(v: unknown): Nutrition | null {
  const n = v as Partial<Nutrition> | null;
  if (!n || !isRange(n.kcal) || !isRange(n.protein) || !isRange(n.carbs) || !isRange(n.fat)) return null;
  return { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat };
}

/** A database row as the app uses it; null when it does not hold together. */
export function savedFoodOf(r: Record<string, unknown>): SavedFood | null {
  const perUnit = nutritionOf(r.per_unit);
  if (!perUnit || typeof r.id !== "string" || typeof r.name !== "string") return null;
  const rec = r.recipe as Partial<SavedRecipe> | null;
  return {
    id: r.id,
    name: r.name,
    kind: r.kind === "food" ? "food" : "recipe",
    unitName: typeof r.unit_name === "string" ? r.unit_name : null,
    yieldUnits: typeof r.yield_units === "number" ? r.yield_units : r.yield_units ? Number(r.yield_units) : null,
    perUnit,
    accuracy: r.accuracy === "high" || r.accuracy === "medium" || r.accuracy === "low" ? r.accuracy : null,
    recipe: rec && rec.understanding && Array.isArray(rec.understanding.ingredients) ? { understanding: rec.understanding, answers: rec.answers ?? {}, labels: rec.labels ?? {} } : null,
  };
}

const COUNT: Record<string, number> = { אחד: 1, אחת: 1, שני: 2, שתי: 2, שניים: 2, שתיים: 2, שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4, חמש: 5, חמישה: 5, שש: 6, שישה: 6, שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10, חצי: 0.5 };
const countOf = (t: string | undefined) => (t === undefined ? null : /^\d+(\.\d+)?$/.test(t) ? Number(t) : (COUNT[t] ?? null));

const PREFIXES = ["", "ו", "ה", "ב", "ל", "מ", "ש", "וה", "וב", "ול", "ומ", "וש", "שה", "מה"];

export interface SavedMatch {
  food: SavedFood;
  count: number;
}

/**
 * Saved foods named in the text, with how many units ("5 טראפלס", "חצי מנה מהקציצות שלי"
 * counts as 1 when no number is next to it), and the text left for the regular parser.
 */
export function matchSaved(text: string, saved: SavedFood[]): { matches: SavedMatch[]; rest: string } {
  if (!saved.length) return { matches: [], rest: text };
  let tokens = normalize(text).split(" ");
  const matches: SavedMatch[] = [];
  const byLength = [...saved].sort((a, b) => b.name.length - a.name.length);
  for (const food of byLength) {
    const words = normalize(food.name).split(" ").filter((w) => w && w !== ",");
    if (!words.length) continue;
    for (let i = 0; i <= tokens.length - words.length; i++) {
      const first = tokens[i];
      const ok = PREFIXES.some((p) => first === p + words[0]) && words.every((w, k) => k === 0 || tokens[i + k] === w);
      if (!ok) continue;
      // A number right before, maybe with a unit word between ("5 כדורים טראפלס").
      let start = i;
      let count = countOf(tokens[i - 1]);
      if (count !== null) start = i - 1;
      else if (countOf(tokens[i - 2]) !== null && tokens[i - 1] !== ",") {
        count = countOf(tokens[i - 2]);
        start = i - 2;
      }
      matches.push({ food, count: count ?? 1 });
      tokens = [...tokens.slice(0, start), ",", ...tokens.slice(i + words.length)];
      break;
    }
  }
  return { matches, rest: tokens.join(" ") };
}

/** A log item for a number of units of a saved food. */
export function savedItem(m: SavedMatch): FoodItem {
  const p = m.food.perUnit;
  const k = (r: [number, number]) => [Math.round((r[0] * m.count) / 5) * 5, Math.round((r[1] * m.count) / 5) * 5] as const;
  const [lo, hi] = k(p.kcal);
  const g = (r: [number, number]) => Math.round(((r[0] + r[1]) / 2) * m.count * 10) / 10;
  return {
    item_name: m.food.name.slice(0, 120),
    quantity: m.count,
    unit: m.food.kind === "food" ? (m.count === 1 ? "מנה" : "מנות") : m.count === 1 ? "יחידה" : (m.food.unitName ?? "יחידות"),
    preparation: null,
    kcal_min: lo,
    kcal_max: hi,
    protein_g: g(p.protein),
    carbs_g: g(p.carbs),
    fat_g: g(p.fat),
    confidence: m.food.accuracy ?? "medium",
  };
}
