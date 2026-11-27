/**
 * The focused questions of "מה אכלת?": asked only where the answer moves the count a lot, and
 * answered with one tap. Each answer scales one food (the same as − / + in the amounts).
 * Pure, for tests. At most two questions; a clear meal gets none.
 */
import type { ParsedItem } from "./parse";

export interface Ask {
  /** Which food of the list it is about. */
  index: number;
  text: string;
  options: { label: string; factor: number }[];
}

const per100 = (p: ParsedItem) => (p.grams > 0 ? (p.kcal / p.grams) * 100 : 0);
const isBread = (p: ParsedItem) => /לחם|חלה|טוסט/.test(p.item_name);

export function asksFor(items: ParsedItem[]): Ask[] {
  const asks: (Ask & { weight: number })[] = [];
  items.forEach((p, index) => {
    // A spoon of tahini, oil or peanut butter: level or heaped is twice the calories.
    if ((p.unitKey === "tbsp" || p.unitKey === "tsp") && per100(p) >= 250 && p.kcal >= 30) {
      asks.push({
        index,
        weight: p.kcal * 1.2,
        text: `כמה גדולה הייתה ${p.unitKey === "tsp" ? "הכפית" : "הכף"} של ה${p.item_name}?`,
        options: [
          { label: "קטנה", factor: 0.6 },
          { label: "רגילה", factor: 1 },
          { label: "גדושה", factor: 1.6 },
        ],
      });
      return;
    }
    if (p.unitKey === "slice" && isBread(p)) {
      asks.push({
        index,
        weight: p.kcal * 0.6,
        text: "הפרוסות היו דקות או עבות?",
        options: [
          { label: "דקות", factor: 0.75 },
          { label: "רגילות", factor: 1 },
          { label: "עבות", factor: 1.4 },
        ],
      });
      return;
    }
    // No amount at all, and a usual portion is a lot of calories (rice, pasta, nuts...).
    if (!p.explicit && p.kcal >= 180) {
      asks.push({
        index,
        weight: p.kcal,
        text: `כמה ${p.item_name} בערך?`,
        options: [
          { label: "מעט", factor: 0.6 },
          { label: "מנה רגילה", factor: 1 },
          { label: "מנה גדולה", factor: 1.5 },
        ],
      });
    }
  });
  return asks
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((a) => ({ index: a.index, text: a.text, options: a.options }));
}
