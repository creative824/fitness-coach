import { describe, expect, it } from "vitest";
import { FOOD_DB } from "@/content/food-db";
import { describeItem, normalize, parseFood, stepFor, withQuantity } from "./parse";

const one = (text: string) => {
  const r = parseFood(text);
  return { ...r, names: r.items.map((i) => i.foodId), lines: r.items.map(describeItem) };
};

describe("food database", () => {
  it("has sane values and portions", () => {
    expect(FOOD_DB.length).toBeGreaterThan(200);
    for (const f of FOOD_DB) {
      expect(f.kcal, f.id).toBeGreaterThanOrEqual(0);
      expect(f.kcal, f.id).toBeLessThan(900);
      // Energy roughly matches the macros (4/4/9), except alcohol and water.
      if (!["beer", "wine", "spirits"].includes(f.id) && f.kcal > 40) {
        const fromMacros = 4 * f.p + 4 * f.c + 9 * f.f;
        expect(Math.abs(fromMacros - f.kcal) / f.kcal, f.id).toBeLessThan(0.25);
      }
      expect(f.u[f.d[0]], f.id).toBeGreaterThan(0);
    }
  });
});

describe("parseFood", () => {
  it("reads the example from the brief", () => {
    const r = one("2 פרוסות לחם עם חביתה");
    expect(r.names).toEqual(["bread", "omelette"]);
    expect(r.items[0].grams).toBe(60);
    expect(r.kcal).toBeGreaterThan(330);
    expect(r.kcal).toBeLessThan(430);
    expect(r.unknown).toEqual([]);
  });

  it("prefers the longest name and strips Hebrew prefixes", () => {
    expect(one("לחם מלא וקוטג׳ והסלט").names).toEqual(["bread_whole", "cottage", "salad"]);
    expect(one("שניצל עוף עם פירה").names).toEqual(["schnitzel", "mashed"]);
  });

  it("takes amounts before and after a food", () => {
    expect(one("ביצים 2 וטוסט").items[0].quantity).toBe(2);
    expect(one("ביצים 2 וטוסט").names).toEqual(["egg", "toast"]);
    expect(one("200 גרם חזה עוף").items[0].grams).toBe(200);
    expect(one("אורז 200 גרם").items[0].grams).toBe(200);
    expect(one("כוס וחצי אורז").items[0].grams).toBe(240);
    expect(one("פיתה וחצי").items[0].quantity).toBe(1.5);
    expect(one("חצי פיתה").items[0].quantity).toBe(0.5);
    expect(one("שתי ביצים").items[0].quantity).toBe(2);
    expect(one("פיצה משולש אחד וקולה זירו").items[0].quantity).toBe(1);
    expect(one("½ אבוקדו").items[0].grams).toBe(75);
  });

  it("uses typical portions and marks them less sure", () => {
    const r = one("במבה");
    expect(r.items[0].grams).toBe(80);
    expect(r.items[0].explicit).toBe(false);
    expect(r.items[0].confidence).toBe("medium");
    expect(one("שווארמה בלאפה").items[0].confidence).toBe("low");
  });

  it("handles 'with', 'without', fried and sizes", () => {
    expect(one("קפה עם חלב בלי סוכר").names).toEqual(["latte"]);
    const cereal = one("קורנפלקס עם חלב");
    expect(cereal.items[1].grams).toBe(150);
    const tea = one("תה עם חלב");
    expect(tea.items[1].grams).toBe(50);
    expect(one("תפוח אדמה מטוגן").names).toEqual(["fries"]);
    const big = one("סלט גדול").items[0];
    expect(big.grams).toBeGreaterThan(200);
  });

  it("reports what it did not recognise", () => {
    const r = one("אכלתי פרלין מיוחד וביצה");
    expect(r.names).toEqual(["egg"]);
    expect(r.unknown).toEqual(["פרלין מיוחד"]);
  });

  it("re-computes an item for a new amount", () => {
    const egg = one("2 ביצים").items[0];
    const three = withQuantity(egg, 3);
    expect(three.grams).toBe(165);
    expect(three.kcal).toBe(Math.round((egg.kcal * 3) / 2));
    expect(stepFor(egg)).toBe(1);
    expect(stepFor(one("חצי פיתה").items[0])).toBe(0.5);
    expect(stepFor(one("200 גרם אורז").items[0])).toBe(50);
  });

  it("normalises numbers and quotes", () => {
    expect(normalize("קוטג׳ 1/2")).toBe("קוטג 0.5");
    expect(normalize("2-3 תמרים")).toBe("2.5 תמרים");
  });
});
