import "server-only";
import { asksFor, type Ask } from "./asks";
import { estimateMeal } from "./estimate";
import { foldSalad } from "./diary";
import type { FoodItem } from "./items";
import { parseFood, toFoodItem, type ParseResult } from "./parse";

export interface Analysis {
  items: FoodItem[];
  /** One question worth asking (an amount the count depends on), or null. */
  question: string | null;
  /** Focused one-tap questions about the database count (the size of a spoon, thick or thin slices). */
  asks: Ask[];
  /** Words neither the food database nor the AI could count. */
  unknown: string[];
  notFood: boolean;
  usedAi: boolean;
  /** Why the AI could not help, when it was needed. */
  aiProblem: string | null;
}

/** A dish that was cooked and shared out, or a restaurant plate: the words alone do not say what is in it. */
const COMPLEX_WORDS =
  /(הכנתי|מתכון|יצאו|יצא לי|אפיתי|בישלתי|מהסיר|סיר|תבנית|תבשיל|פשטידה|קדרה|ממולא|ממולאים|ברוטב|במסעדה|מסעדה|ממשלוח|משלוח|קייטרינג|בופה|מגש|מנה של|חצי מנה|מנה עיקרית|קומבינציה|ארוחה עסקית)/;

export type Complexity = { complex: false } | { complex: true; reason: "unknown" | "recipe" | "mixed_dish" | "vague" };

/**
 * When is the database not enough on its own? Pure, for tests.
 * - Words it does not know.
 * - A recipe or a pot ("הכנתי… יצאו 40", "מהסיר"), a restaurant plate, a stuffed or sauced dish.
 * - A mixed dish (shakshuka, burger, pasta in sauce…) with no amount: its portion varies a lot.
 * - Most of the foods had no amount at all, so the count is mostly the usual portion.
 */
export function complexity(text: string, local: ParseResult): Complexity {
  if (COMPLEX_WORDS.test(text)) return { complex: true, reason: "recipe" };
  if (local.unknown.length) return { complex: true, reason: "unknown" };
  if (local.items.some((i) => i.confidence === "low")) return { complex: true, reason: "mixed_dish" };
  const guessed = local.items.filter((i) => !i.explicit).length;
  if (local.items.length >= 3 && guessed / local.items.length > 0.6 && /(צלחת|קערה|הרבה|קצת|ענק|מלא|כמה)/.test(text)) return { complex: true, reason: "vague" };
  return { complex: false };
}

/**
 * Free text → foods, amounts and numbers.
 *
 * 1. The food database (USDA values and Israeli labels, src/content/food-db.ts) reads the text
 *    and counts what it knows, at once and for free. A clear meal ("2 ביצים ופרוסת לחם") ends here.
 * 2. When the meal is not clear (see `complexity`), Gemini reads it: what the foods are, how much,
 *    how it was made, how many units a recipe made and how many were eaten. The numbers are then
 *    counted in code from the database again (recipe.ts); Gemini's own per-100 g guess is used
 *    only for a food no source has. Unknown words alone are sent when the rest was clear.
 * 3. If Gemini cannot help (no key, daily limit, busy), the database count stays and the user is
 *    asked about what is missing.
 */
export async function analyzeText(text: string, allowAi: () => Promise<boolean>): Promise<Analysis> {
  const local = parseFood(text);
  const folded = foldSalad(text, local.items);
  const items = folded.map(toFoodItem);
  const base: Analysis = { items, question: null, asks: asksFor(folded), unknown: local.unknown, notFood: !items.length && !local.unknown.length, usedAi: false, aiProblem: null };
  const c = complexity(text, local);
  if (!c.complex) return base;
  if (!process.env.GEMINI_API_KEY) return { ...base, aiProblem: local.unknown.length ? "no_key" : null };
  if (!(await allowAi())) return { ...base, aiProblem: local.unknown.length ? "limit" : null };

  // Only unknown words in an otherwise clear meal; the whole text when the meal itself is complex,
  // so the AI sees the context ("הכנתי עוגה… אכלתי 2 פרוסות").
  const onlyWords = c.reason === "unknown" && items.length > 0 && !COMPLEX_WORDS.test(text) && !local.items.some((i) => i.confidence === "low");
  const ai = await estimateMeal(onlyWords ? local.unknown.join(", ") : text);
  if (ai.ok) {
    return { items: onlyWords ? [...items, ...ai.items] : ai.items, question: ai.question, asks: onlyWords ? base.asks : [], unknown: [], notFood: false, usedAi: true, aiProblem: null };
  }
  if (ai.reason === "not_food") return { ...base, unknown: items.length ? [] : local.unknown, notFood: !items.length, usedAi: true };
  return { ...base, aiProblem: local.unknown.length ? ai.reason : null };
}
