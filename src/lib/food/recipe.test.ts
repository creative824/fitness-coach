import { describe, expect, it } from "vitest";
import { computeMeal, findFood, pointOf, rounded, type Understanding } from "./recipe";

/** What the AI returns for the truffle message (mocked: the AI only understands, it does not count). */
const truffles: Understanding = {
  dish: "טראפלס",
  kind: "recipe",
  ingredients: [
    { name: "שוקולד מריר", qty: 1, unit: "package", approx: false, per100: { kcal: 550, p: 7, c: 45, f: 38 } },
    { name: "חמאת בוטנים טבעית", qty: 1, unit: "package", approx: false, per100: { kcal: 600, p: 25, c: 20, f: 50 } },
    { name: "קורנפלקס", qty: 1, unit: "cup", approx: true, per100: null },
  ],
  yieldUnits: { min: 40, max: 40 },
  unitName: "כדורים",
  eaten: { min: 6, max: 7 },
};

describe("food engine: the truffle recipe", () => {
  it("matches the three ingredients to the food database", () => {
    expect(findFood("שוקולד מריר")?.id).toBe("dark_chocolate");
    expect(findFood("חמאת בוטנים טבעית")?.id).toBe("peanut_butter");
    expect(findFood("קורנפלקס")?.id).toBe("cornflakes");
  });

  it("asks for the missing package weights, the one that matters most first", () => {
    const m = computeMeal(truffles);
    expect(m.questions.map((q) => q.key)).toEqual(["g:1", "g:0"]);
    expect(m.questions[0].options.map((o) => o.value)).toContain(340);
    expect(m.accuracy).toBe("medium");
  });

  it("counts the whole recipe, one piece and 6–7 pieces, with sensible values", () => {
    const m = computeMeal(truffles, { answers: { "g:0": 100, "g:1": 340 } });
    // 100 g dark chocolate (598) + 340 g peanut butter (≈2033) + ~30 g cornflakes (≈115).
    expect(m.total.kcal[0]).toBeGreaterThan(2700);
    expect(m.total.kcal[1]).toBeLessThan(2800);
    expect(m.lines.every((l) => l.source === "db")).toBe(true);
    const piece = rounded(m.perUnit!);
    expect(piece.kcal[0]).toBeGreaterThanOrEqual(65);
    expect(piece.kcal[1]).toBeLessThanOrEqual(75);
    // 6–7 of 40 pieces: 15–17.5% of the recipe, 16.25% by default.
    expect(m.share[0]).toBeCloseTo(0.15);
    expect(m.share[1]).toBeCloseTo(0.175);
    expect(pointOf(m.share)).toBeCloseTo(0.1625);
    expect(m.meal.kcal[0]).toBeGreaterThan(400);
    expect(m.meal.kcal[1]).toBeLessThan(500);
    expect(m.meal.protein[0]).toBeGreaterThan(10);
    expect(m.questions).toHaveLength(0);
  });

  it("prefers a package label typed by the user over the database", () => {
    const m = computeMeal(truffles, { answers: { "g:0": 100, "g:1": 340 }, labels: { 0: { kcal: 520, p: 9, c: 30, f: 40 } } });
    expect(m.lines[0].source).toBe("label");
    expect(m.lines[0].kcal).toEqual([520, 520]);
  });

  it("falls back to the AI's estimate, flagged, for a food the database does not know", () => {
    const m = computeMeal({ dish: "עוגת תמרים", kind: "single", ingredients: [{ name: "עוגת תמרים ביתית", qty: 80, unit: "g", approx: false, per100: { kcal: 350, p: 5, c: 55, f: 12 } }], yieldUnits: null, unitName: null, eaten: null });
    expect(m.lines[0].source).toBe("ai");
    expect(m.accuracy).toBe("low");
    expect(m.meal.kcal).toEqual([280, 280]);
  });

  it("asks how many units the recipe made and how many were eaten when not said", () => {
    const m = computeMeal({ ...truffles, yieldUnits: null, eaten: null }, { answers: { "g:0": 100, "g:1": 340 } });
    expect(m.questions.map((q) => q.key)).toEqual(expect.arrayContaining(["yield", "eaten"]));
    expect(m.accuracy).toBe("low");
  });
});
