import "server-only";
import { estimateMeal } from "./estimate";
import { foldSalad } from "./diary";
import type { FoodItem } from "./items";
import { parseFood, toFoodItem } from "./parse";

export interface Analysis {
  items: FoodItem[];
  /** One question worth asking (an amount the count depends on), or null. */
  question: string | null;
  /** Words neither the food database nor the AI could count. */
  unknown: string[];
  notFood: boolean;
  usedAi: boolean;
  /** Why the AI could not help with the unknown words, when it was asked. */
  aiProblem: string | null;
}

/**
 * Free text → foods, amounts and numbers. The food database (USDA values and Israeli labels,
 * src/content/food-db.ts) reads and counts everything it knows, at once and for free. Words it
 * does not know go to Gemini, which only says what they are and how much (estimate.ts); the
 * numbers are then counted in code from the database again (recipe.ts). Gemini's own per-100 g
 * guess is used only for a food that no source has.
 */
export async function analyzeText(text: string, allowAi: () => Promise<boolean>): Promise<Analysis> {
  const local = parseFood(text);
  const items = foldSalad(text, local.items).map(toFoodItem);
  if (!local.unknown.length) return { items, question: null, unknown: [], notFood: !items.length, usedAi: false, aiProblem: null };
  if (!process.env.GEMINI_API_KEY) return { items, question: null, unknown: local.unknown, notFood: false, usedAi: false, aiProblem: "no_key" };
  if (!(await allowAi())) return { items, question: null, unknown: local.unknown, notFood: false, usedAi: false, aiProblem: "limit" };
  // Only the words the database did not know, unless it knew nothing (then the whole text, so
  // the AI sees the context: "הכנתי עוגה… אכלתי 2 פרוסות").
  const ai = await estimateMeal(items.length ? local.unknown.join(", ") : text);
  if (ai.ok) return { items: [...items, ...ai.items], question: ai.question, unknown: [], notFood: false, usedAi: true, aiProblem: null };
  if (ai.reason === "not_food") {
    return { items, question: null, unknown: items.length ? [] : local.unknown, notFood: !items.length, usedAi: true, aiProblem: null };
  }
  return { items, question: null, unknown: local.unknown, notFood: false, usedAi: false, aiProblem: ai.reason };
}
