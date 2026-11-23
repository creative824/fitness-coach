import { describe, expect, it } from "vitest";
import { FOODS } from "@/content/menu-foods";
import { MENU_MEALS } from "@/content/menu-meals";
import { allowedFor, buildMenu, mealBySlug, optionPosition, renderMeal, reshuffle, slotKcal, slotLabels, swapSlot, tagsOf, upgradeMenu, type DayMenu, type DietProfile } from "./engine";
import { choicesFor, chooseSlot, plannedKcal } from "./engine";

const anyone: DietProfile = { pattern: "omnivore", allergies: [], avoid: [] };
const total = (m: ReturnType<typeof buildMenu>) => m.slots.reduce((s, x) => s + slotKcal(x), 0);

describe("menu library", () => {
  it("uses only known foods and has options for every slot", () => {
    for (const m of MENU_MEALS) for (const p of m.parts) expect(FOODS[p.food], `${m.slug}:${p.food}`).toBeDefined();
    for (const slot of ["breakfast", "snack", "lunch", "dinner"] as const) {
      expect(MENU_MEALS.filter((m) => m.slots.includes(slot)).length).toBeGreaterThanOrEqual(8);
    }
    expect(new Set(MENU_MEALS.map((m) => m.slug)).size).toBe(MENU_MEALS.length);
  });

  it("never mixes meat and milk in one meal (kosher)", () => {
    for (const m of MENU_MEALS) {
      const t = tagsOf(m);
      expect(t.has("meat") && t.has("milk"), m.slug).toBe(false);
    }
  });
});

describe("buildMenu", () => {
  it.each([1400, 1800, 2200, 2800])("adds up to a %i kcal target", (target) => {
    for (let seed = 1; seed < 30; seed++) {
      const m = buildMenu({ target, mealsPerDay: 5, profile: anyone, seed });
      expect(m.slots).toHaveLength(5);
      expect(Math.abs(total(m) - target), `seed ${seed}`).toBeLessThanOrEqual(Math.max(60, target * 0.04));
      expect(new Set(m.slots.map((s) => s.meal)).size).toBe(5);
    }
  });

  it("follows meals per day", () => {
    // Between-meal snacks are part of every day, also for "3 meals a day".
    expect(buildMenu({ target: 2000, mealsPerDay: 3, profile: anyone, seed: 1 }).slots.map((s) => s.type)).toEqual(["breakfast", "snack", "lunch", "snack", "dinner"]);
    expect(buildMenu({ target: 2000, mealsPerDay: 6, profile: anyone, seed: 1 }).slots).toHaveLength(6);
  });

  it("respects a vegan diet and allergies", () => {
    const vegan: DietProfile = { pattern: "vegan", allergies: ["sesame", "gluten"], avoid: [] };
    for (let seed = 1; seed < 20; seed++) {
      const m = buildMenu({ target: 2000, mealsPerDay: 5, profile: vegan, seed });
      for (const s of m.slots) {
        const tags = tagsOf(mealBySlug(s.meal)!);
        for (const bad of ["egg", "milk", "meat", "fish", "sesame", "gluten"] as const) expect(tags.has(bad), s.meal).toBe(false);
      }
    }
  });

  it("leaves out disliked foods", () => {
    const ok = allowedFor({ pattern: null, allergies: [], avoid: ["טונה"] });
    expect(ok(mealBySlug("pasta-tuna")!)).toBe(false);
    expect(ok(mealBySlug("chicken-rice")!)).toBe(true);
  });
});

describe("renderMeal", () => {
  it("scales portions to the target in household steps", () => {
    const meal = mealBySlug("chicken-rice")!;
    const small = renderMeal(meal, 400);
    const big = renderMeal(meal, 750);
    expect(Math.abs(small.kcal - 400)).toBeLessThan(40);
    expect(Math.abs(big.kcal - 750)).toBeLessThan(40);
    const rice = big.items.find((i) => i.food === "rice")!;
    expect(rice.qty % 25).toBe(0);
    expect(big.items.find((i) => i.food === "salad")!.qty).toBe(1);
  });

  it("writes amounts people can follow", () => {
    const r = renderMeal(mealBySlug("omelette-bread")!, 400);
    const egg = r.items.find((i) => i.food === "egg")!;
    expect(Number.isInteger(egg.qty)).toBe(true);
    expect(egg.name).toMatch(/ביצ/);
  });
});

describe("swap", () => {
  it("swaps one meal at the same calories and cycles through options", () => {
    const m = buildMenu({ target: 2000, mealsPerDay: 5, profile: anyone, seed: 7 });
    const s = swapSlot(m, 2, anyone);
    expect(s.slots[2].meal).not.toBe(m.slots[2].meal);
    expect(s.slots[2].kcal).toBe(m.slots[2].kcal);
    expect(s.slots.filter((_, i) => i !== 2)).toEqual(m.slots.filter((_, i) => i !== 2));
    const pos = optionPosition(s, 2, anyone);
    expect(pos.of).toBeGreaterThan(3);
  });

  it("does not swap an eaten meal and keeps it on reshuffle", () => {
    const m = buildMenu({ target: 2000, mealsPerDay: 5, profile: anyone, seed: 3 });
    m.slots[0] = { ...m.slots[0], eaten: { logId: "x" } };
    expect(swapSlot(m, 0, anyone)).toBe(m);
    const r = reshuffle(m, { target: 2000, mealsPerDay: 5, profile: anyone }, 99);
    expect(r.slots[0]).toEqual(m.slots[0]);
    expect(Math.abs(total(r) - 2000)).toBeLessThanOrEqual(80);
  });
});

describe("snacks and upgrades", () => {
  it("names snacks by the meal before them", () => {
    expect(slotLabels(["breakfast", "snack", "lunch", "snack", "dinner", "snack"])).toEqual([
      "ארוחת בוקר",
      "ארוחת ביניים · בוקר",
      "ארוחת צהריים",
      "ארוחת ביניים · אחה״צ",
      "ארוחת ערב",
      "ארוחת ביניים · ערב",
    ]);
  });

  it("rebuilds a 3-meal menu with snacks and keeps what was eaten", () => {
    const old: DayMenu = {
      v: 1,
      target: 1800,
      seed: 7,
      slots: [
        { type: "breakfast", kcal: 540, meal: "omelette-bread", eaten: { logId: "a" } },
        { type: "lunch", kcal: 720, meal: buildMenu({ target: 1800, mealsPerDay: 5, profile: anyone, seed: 3 }).slots[2].meal },
        { type: "dinner", kcal: 540, meal: buildMenu({ target: 1800, mealsPerDay: 5, profile: anyone, seed: 3 }).slots[4].meal },
      ],
    };
    const up = upgradeMenu(old, { target: 1800, mealsPerDay: 3, profile: anyone });
    expect(up.v).toBe(2);
    expect(up.slots.map((s) => s.type)).toEqual(["breakfast", "snack", "lunch", "snack", "dinner"]);
    expect(up.slots[0]).toEqual(old.slots[0]);
    const total = up.slots.reduce((a, s) => a + slotKcal(s), 0);
    expect(Math.abs(total - 1800)).toBeLessThan(90);
    // Already current: returned as is.
    expect(upgradeMenu(up, { target: 1800, mealsPerDay: 3, profile: anyone })).toBe(up);
  });
});

describe("choices and hand-set calories", () => {
  const anyone = { pattern: null, allergies: [], avoid: [] };
  it("offers at least 20 meals for every kind of slot", () => {
    const m = buildMenu({ target: 1800, mealsPerDay: 5, profile: anyone, seed: 3 });
    for (let i = 0; i < m.slots.length; i++) expect(choicesFor(m, i, anyone).length, m.slots[i].type).toBeGreaterThanOrEqual(20);
  });
  it("puts a chosen meal in the slot at the same calories", () => {
    const m = buildMenu({ target: 1800, mealsPerDay: 5, profile: anyone, seed: 3 });
    const pick = choicesFor(m, 0, anyone).find((c) => c.slug !== m.slots[0].meal)!;
    const next = chooseSlot(m, 0, pick.slug, anyone);
    expect(next.slots[0].meal).toBe(pick.slug);
    expect(next.slots[0].kcal).toBe(m.slots[0].kcal);
    expect(chooseSlot(m, 0, "chicken-rice", { ...anyone, pattern: "vegan" })).toBe(m);
  });
  it("keeps a hand-set slot and shares the rest of the target", () => {
    const plan = plannedKcal(1800, 5, [250, null, null, null, null]);
    expect(plan[0]).toBe(250);
    expect(plan.reduce((a, b) => a + b, 0)).toBeCloseTo(1800, -1);
    const m = buildMenu({ target: 1800, mealsPerDay: 5, profile: anyone, seed: 5, custom: [250, null, null, null, null] });
    expect(m.slots[0].kcal).toBe(250);
    expect(m.custom).toEqual([250, null, null, null, null]);
    expect(Math.abs(total(m) - 1800)).toBeLessThanOrEqual(80);
  });
  it("offers light breakfasts first for a light morning", () => {
    const m = buildMenu({ target: 1800, mealsPerDay: 5, profile: anyone, seed: 9, custom: [250, null, null, null, null] });
    const top = choicesFor(m, 0, anyone).slice(0, 5);
    expect(top.filter((c) => c.light).length).toBeGreaterThanOrEqual(3);
  });
});
