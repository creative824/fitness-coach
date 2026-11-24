import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { foodItemSchema, mealTypeAt, saveFoodSchema, totalsOf } from "./items";
import { parseUnderstanding } from "./recipe";

const item = (o: Record<string, unknown>) => foodItemSchema.parse({ item_name: "חביתה", ...o });

describe("food items", () => {
  it("keeps every estimate as a range, never upside down", () => {
    expect(item({ kcal_min: 300, kcal_max: 200 })).toMatchObject({ kcal_min: 200, kcal_max: 300 });
    expect(item({ kcal_min: 150 })).toMatchObject({ kcal_min: 150, kcal_max: 150 });
    expect(item({})).toMatchObject({ kcal_min: null, kcal_max: null, confidence: null });
  });

  it("rejects impossible values", () => {
    expect(foodItemSchema.safeParse({ item_name: "x", kcal_min: -5 }).success).toBe(false);
    expect(foodItemSchema.safeParse({ item_name: "x", kcal_max: 99999 }).success).toBe(false);
    expect(foodItemSchema.safeParse({ item_name: "" }).success).toBe(false);
  });

  it("adds up a day as a rounded range and counts items without an estimate", () => {
    const t = totalsOf([item({ kcal_min: 143, kcal_max: 181, protein_g: 12 }), item({ kcal_min: 90, kcal_max: 120, fat_g: 5 }), item({})]);
    expect(t.kcal).toEqual([230, 310]);
    expect(t).toMatchObject({ protein: 12, fat: 5, carbs: null, missing: 1 });
    expect(totalsOf([]).kcal).toBeNull();
  });

  it("suggests a meal from the hour", () => {
    expect(mealTypeAt(8 * 60)).toBe("breakfast");
    expect(mealTypeAt(13 * 60)).toBe("lunch");
    expect(mealTypeAt(20 * 60)).toBe("dinner");
    expect(mealTypeAt(16 * 60 + 30)).toBe("snack");
  });

  it("needs a client ref so a retried save is not stored twice", () => {
    expect(saveFoodSchema.safeParse({ text: "סלט", mealType: null, status: "confirmed", estimated: false, items: [] }).success).toBe(false);
  });
});

describe("reading what the AI understood", () => {
  it("keeps valid ingredients and drops broken ones; no totals are taken from the AI", () => {
    const r = parseUnderstanding(
      JSON.stringify({
        not_food: false,
        dish: "טראפלס",
        kind: "recipe",
        ingredients: [
          { name: "שוקולד מריר", qty: 1, unit: "package", approx: false, kcal_100: 550, protein_100: 7, carbs_100: 45, fat_100: 38 },
          { name: "", qty: 1, unit: "cup", approx: false, kcal_100: 1, protein_100: 1, carbs_100: 1, fat_100: 1 },
          { name: "קורנפלקס", qty: 1, unit: "bucket", approx: true, kcal_100: 380, protein_100: 6, carbs_100: 88, fat_100: 1 },
        ],
        yield_min: 40,
        yield_max: 40,
        unit_name: "כדורים",
        eaten_min: 7,
        eaten_max: 6,
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.understanding.ingredients).toHaveLength(2);
    expect(r.understanding.ingredients[1]).toMatchObject({ name: "קורנפלקס", unit: null, approx: true });
    expect(r.understanding.eaten).toEqual({ min: 6, max: 7 });
    expect(r.understanding.yieldUnits).toEqual({ min: 40, max: 40 });
  });

  it("says when the text is not food, and fails safely on bad output", () => {
    expect(parseUnderstanding(JSON.stringify({ not_food: true, ingredients: [] }))).toEqual({ ok: false, reason: "not_food" });
    expect(parseUnderstanding("not json")).toEqual({ ok: false, reason: "failed" });
    expect(parseUnderstanding(JSON.stringify({ kind: "single", ingredients: [] }))).toEqual({ ok: false, reason: "failed" });
  });
});
