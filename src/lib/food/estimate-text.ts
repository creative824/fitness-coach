import "server-only";
import { estimateMeal } from "./estimate";
import type { FoodItem } from "./items";
import { parseFood, toFoodItem } from "./parse";

export interface TextEstimate {
  items: FoodItem[];
  /** Words neither the database nor the AI could count. */
  unknown: string[];
  usedAi: boolean;
  notFood: boolean;
}

/**
 * Calories for free text on the server (Telegram, and saves that came without items): the food
 * database first, and the AI only for the words it does not know, when `allowAi` agrees (a
 * key is set and the daily quota allows it).
 */
export async function estimateText(text: string, allowAi: () => Promise<boolean>): Promise<TextEstimate> {
  const local = parseFood(text);
  const items: FoodItem[] = local.items.map(toFoodItem);
  if (!local.unknown.length || !process.env.GEMINI_API_KEY || !(await allowAi())) {
    return { items, unknown: local.unknown, usedAi: false, notFood: !items.length && !local.unknown.length };
  }
  const ai = await estimateMeal(local.items.length ? local.unknown.join(", ") : text);
  if (ai.ok) return { items: [...items, ...ai.items], unknown: [], usedAi: true, notFood: false };
  return { items, unknown: local.unknown, usedAi: false, notFood: ai.reason === "not_food" && !items.length };
}
