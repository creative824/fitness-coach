import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { analyzeText } from "./analyze";
import { foldSalad, foodsLine, insightFor, itemLabel, nextFactor, orderMeals, scaleItem, sectionOf, summarize, titleOf, type DiaryMeal } from "./diary";
import type { FoodItem } from "./items";
import { parseFood, toFoodItem } from "./parse";
import { readReply } from "./photo";

const item = (over: Partial<FoodItem> = {}): FoodItem => ({
  item_name: "ביצים",
  quantity: 2,
  unit: "יחידות (110 ג׳)",
  preparation: null,
  kcal_min: 140,
  kcal_max: 160,
  protein_g: 13,
  carbs_g: 1,
  fat_g: 10,
  confidence: "high",
  ...over,
});

// 13:30 Israel time is 11:30 UTC in winter.
const at = (hhmm: string) => `2026-11-25T${String(Number(hhmm.slice(0, 2)) - 2).padStart(2, "0")}:${hhmm.slice(3)}:00Z`;
const meal = (over: Partial<DiaryMeal>): DiaryMeal => ({ id: "x", mealType: "lunch", text: "", loggedAt: at("13:30"), status: "confirmed", items: [item()], ...over });

describe("sections of the day", () => {
  it("puts snacks before or after lunch by the hour, nibbles last", () => {
    expect(sectionOf("snack", at("10:30"))).toBe("midmorning");
    expect(sectionOf("snack", at("16:30"))).toBe("afternoon");
    expect(sectionOf("nibble", at("09:00"))).toBe("nibbles");
    expect(sectionOf("other", at("20:00"))).toBe("dinner");
    expect(titleOf("other", at("20:00"))).toBe("ארוחה");
  });
  it("orders meals by the day, not by when they were typed", () => {
    const list = orderMeals([meal({ id: "d", mealType: "dinner", loggedAt: at("19:00") }), meal({ id: "b", mealType: "breakfast", loggedAt: at("20:00") }), meal({ id: "s", mealType: "snack", loggedAt: at("10:00") })]);
    expect(list.map((m) => m.id)).toEqual(["b", "s", "d"]);
  });
});

describe("reading the diary", () => {
  it("writes foods the way people say them", () => {
    expect(itemLabel(item())).toBe("2 ביצים");
    expect(itemLabel(item({ item_name: "לחם מלא", unit: "פרוסות (64 ג׳)" }))).toBe("2 פרוסות לחם מלא");
    expect(itemLabel(item({ item_name: "פיתה", quantity: 0.5, unit: "יחידה (38 ג׳)" }))).toBe("חצי פיתה");
    expect(foodsLine([{ item_name: "חזה עוף" }, { item_name: "אורז" }, { item_name: "סלט" }])).toBe("חזה עוף, אורז וסלט");
  });
});

describe("changing amounts", () => {
  it("scales every number and the grams in the unit", () => {
    const three = scaleItem(item(), 1.5);
    expect(three.quantity).toBe(3);
    expect(three.kcal_min).toBe(210);
    expect(three.protein_g).toBe(19.5);
    expect(three.unit).toBe("יחידות (165 ג׳)");
  });
  it("steps one egg, a quarter of the grams, or half a portion", () => {
    expect(nextFactor(item(), 1, 1)).toBe(1.5); // 2 eggs → 3
    expect(nextFactor(item({ quantity: 200, unit: "גרם" }), 1, -1)).toBe(0.75); // 200 g → 150 g
    expect(nextFactor(item({ quantity: null, unit: null }), 1, -1)).toBe(0.5);
    expect(nextFactor(item({ quantity: null, unit: null }), 0.5, -1)).toBeNull();
  });
});

describe("free text through the food engine", () => {
  it("counts the example meal from the database, with the salad as one item", async () => {
    const text = "אכלתי 2 ביצים, 2 פרוסות לחם מלא, סלט עם מלפפון ועגבנייה וכף טחינה.";
    const ai = vi.fn(async () => true);
    const a = await analyzeText(text, ai);
    expect(ai).not.toHaveBeenCalled();
    expect(a.items.map((i) => i.item_name)).toEqual(["ביצים", "לחם מלא", "סלט", "טחינה"]);
    const kcal = a.items.reduce((s, i) => s + ((i.kcal_min ?? 0) + (i.kcal_max ?? 0)) / 2, 0);
    expect(kcal).toBeGreaterThan(380);
    expect(kcal).toBeLessThan(520);
  });
  it("understands loose amounts", () => {
    for (const t of ["צלחת גדולה של אורז", "קצת טחינה", "שתי חתיכות עוף", "חופן אגוזים", "חצי פיתה"]) {
      const r = parseFood(t);
      expect(r.items.length, t).toBe(1);
      expect(r.unknown, t).toEqual([]);
    }
  });
  it("keeps raw vegetables that are not part of a salad", () => {
    const text = "מלפפון ועגבנייה";
    expect(foldSalad(text, parseFood(text).items).map(toFoodItem)).toHaveLength(2);
  });
  it("without an AI key, asks about the words it does not know instead of guessing", async () => {
    const before = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const a = await analyzeText("2 ביצים וקרפלאך", async () => true);
    process.env.GEMINI_API_KEY = before;
    expect(a.items).toHaveLength(1);
    expect(a.unknown.join(" ")).toContain("קרפלאך");
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("photo reply", () => {
  it("reads the text, or says there is no food", () => {
    expect(readReply(JSON.stringify({ text: "2 ביצים, פרוסת לחם", not_food: false }))).toEqual({ ok: true, text: "2 ביצים, פרוסת לחם" });
    expect(readReply(JSON.stringify({ text: "", not_food: true }))).toEqual({ ok: false, reason: "not_food" });
    expect(readReply("nope")).toBeNull();
  });
});

describe("end of day", () => {
  const day = [
    meal({ id: "b", mealType: "breakfast", loggedAt: at("08:00"), items: [item({ protein_g: 20, kcal_min: 400, kcal_max: 400 })] }),
    meal({ id: "l", mealType: "lunch", items: [item({ protein_g: 45, kcal_min: 620, kcal_max: 620 })] }),
    meal({ id: "d", mealType: "dinner", status: "draft", items: [item({ protein_g: 99, kcal_min: 900, kcal_max: 900 })] }),
  ];
  it("counts confirmed meals, finds the richest in protein and says what is left", () => {
    const s = summarize(day, 2000, 120);
    expect(s.meals).toBe(2);
    expect(s.kcal).toBe(1020);
    expect(s.protein).toBe(65);
    expect(s.left).toBe(980);
    expect(s.richest).toEqual({ title: "ארוחת צהריים", protein: 45 });
    expect(s.proteinGoal).toBe(false);
  });
  it("gives one short insight", () => {
    expect(insightFor({ kcal: 1800, protein: 110, target: 2000, proteinTarget: 120, meals: day, finished: true })).toBe("היום הגעת ל-92% מיעד החלבון שלך.");
    const noBreakfast = day.filter((m) => m.id !== "b");
    expect(insightFor({ kcal: 1500, protein: 50, target: 2000, proteinTarget: 120, meals: noBreakfast, finished: true })).toContain("כבר בארוחת הבוקר");
  });
});

describe("a unit with ו starts the next food", () => {
  it("reads 'עגבנייה וכף טחינה' as one spoon of tahini", () => {
    const r = parseFood("עגבנייה וכף טחינה");
    expect(r.items.map((i) => [i.item_name, i.quantity, i.unitKey])).toEqual([
      ["עגבנייה", 1, "pc"],
      ["טחינה", 1, "tbsp"],
    ]);
  });
});
