import { describe, expect, it } from "vitest";
import { computeMeal, type Understanding } from "./recipe";
import { matchSaved, savedItem, type SavedFood } from "./saved";
import { parseFood } from "./parse";

const u: Understanding = {
  dish: "טראפלס",
  kind: "recipe",
  ingredients: [
    { name: "שוקולד מריר", qty: 1, unit: "package", approx: false, per100: null },
    { name: "חמאת בוטנים", qty: 1, unit: "package", approx: false, per100: null },
    { name: "קורנפלקס", qty: 1, unit: "cup", approx: true, per100: null },
  ],
  yieldUnits: { min: 40, max: 40 },
  unitName: "כדורים",
  eaten: { min: 6, max: 7 },
};
const m = computeMeal(u, { answers: { "g:0": 100, "g:1": 340 } });
const truffle: SavedFood = { id: "x", name: "טראפלס", kind: "recipe", unitName: "כדורים", yieldUnits: 40, perUnit: m.perUnit!, accuracy: m.accuracy, recipe: { understanding: u, answers: { "g:0": 100, "g:1": 340 }, labels: {} } };

describe("saved recipes", () => {
  it("\"אכלתי 5 טראפלס\" counts five saved units without the AI", () => {
    const r = matchSaved("אכלתי 5 טראפלס", [truffle]);
    expect(r.matches).toEqual([{ food: truffle, count: 5 }]);
    const item = savedItem(r.matches[0]);
    expect(Math.abs(item.kcal_min! - m.perUnit!.kcal[0] * 5)).toBeLessThanOrEqual(5);
    expect(Math.abs(item.kcal_max! - m.perUnit!.kcal[1] * 5)).toBeLessThanOrEqual(5);
    expect(item.kcal_min).toBeGreaterThan(300);
    expect(item.unit).toBe("כדורים");
    // Nothing left for the parser to call unknown.
    expect(parseFood(r.rest).unknown).toEqual([]);
  });

  it("works with words, prefixes and other foods around it", () => {
    expect(matchSaved("שלושה טראפלס וקפה", [truffle]).matches[0].count).toBe(3);
    expect(matchSaved("קפה והטראפלס", [truffle]).matches[0].count).toBe(1);
    const r = matchSaved("2 פרוסות לחם ו-4 טראפלס", [truffle]);
    expect(r.matches[0].count).toBe(4);
    expect(parseFood(r.rest).items.map((i) => i.foodId)).toEqual(["bread"]);
  });
});
