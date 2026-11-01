import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { foodItemSchema, mealTypeAt, saveFoodSchema, totalsOf } from "./items";
import { parseEstimate } from "./estimate";

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

describe("parsing the AI estimate", () => {
  it("keeps valid items and the clarifying question", () => {
    const r = parseEstimate(
      JSON.stringify({
        not_food: false,
        question: "  החביתה טוגנה בשמן? ",
        items: [
          { item_name: "חביתה", quantity: 1, unit: "ביצה", kcal_min: 90, kcal_max: 140, protein_g: 6, carbs_g: 1, fat_g: 7, confidence: "medium" },
          { item_name: "", kcal_min: 1, kcal_max: 2 },
        ],
      }),
    );
    expect(r).toMatchObject({ ok: true, question: "החביתה טוגנה בשמן?" });
    if (r.ok) expect(r.items).toHaveLength(1);
  });

  it("says when the text is not food, and fails safely on bad output", () => {
    expect(parseEstimate(JSON.stringify({ not_food: true, items: [] }))).toEqual({ ok: false, reason: "not_food" });
    expect(parseEstimate("not json")).toEqual({ ok: false, reason: "failed" });
    expect(parseEstimate(JSON.stringify({ items: [] }))).toEqual({ ok: false, reason: "failed" });
  });
});
