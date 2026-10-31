import { describe, expect, it } from "vitest";
import { EQUIPMENT } from "@/lib/onboarding/schema";
import { EXERCISES } from "./exercises";
import { MUSCLES } from "./muscles";
import { MEAL_IDEAS, type Allergen } from "./meal-ideas";

const muscleIds = new Set<string>(MUSCLES.map((m) => m.id));

describe("exercise library", () => {
  it("has unique slugs", () => {
    expect(new Set(EXERCISES.map((e) => e.slug)).size).toBe(EXERCISES.length);
  });

  it.each(EXERCISES.map((e) => [e.slug, e] as const))("%s references valid muscles, equipment and regressions", (_, e) => {
    expect(e.primary.length).toBeGreaterThan(0);
    for (const m of [...e.primary, ...e.secondary]) expect(muscleIds.has(m)).toBe(true);
    for (const m of e.primary) expect(e.secondary).not.toContain(m);
    for (const q of e.equipment) expect(EQUIPMENT).toContain(q);
    if (e.easier) expect(EXERCISES.some((x) => x.slug === e.easier)).toBe(true);
    expect(e.steps.length).toBeGreaterThanOrEqual(1);
    expect(e.cautions.length).toBeGreaterThan(0);
  });

  it("covers every clickable muscle with at least two exercises", () => {
    for (const id of ["chest", "upper_back", "lower_back", "shoulders", "biceps", "triceps", "abs", "glutes", "quads", "hamstrings", "calves"]) {
      expect(EXERCISES.filter((e) => e.primary.includes(id as never)).length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it("offers a no-equipment option for each category", () => {
    for (const c of ["strength", "cardio", "mobility", "core"] as const) {
      expect(EXERCISES.some((e) => e.category === c && e.equipment.every((q) => q === "mat"))).toBe(true);
    }
  });

  it("matches the spec's sample muscle mapping (§11)", () => {
    const pick = (slug: string) => EXERCISES.find((e) => e.slug === slug)!;
    expect(pick("push-up").primary).toEqual(["chest"]);
    expect(pick("bodyweight-squat").primary).toEqual(["quads", "glutes"]);
    expect(pick("db-row").primary).toEqual(["upper_back"]);
    expect(pick("romanian-deadlift-db").primary).toEqual(["hamstrings", "glutes"]);
    expect(pick("plank").primary).toEqual(["abs"]);
  });
});

/** Words that imply an allergen. An idea must declare every allergen its text implies. */
const ALLERGEN_HINTS: [RegExp, Allergen][] = [
  [/טחינה|חומוס מוכן|שומשום/, "sesame"],
  [/יוגורט|קוטג׳|גבינ|חמאה(?! בוטנים)|שמנת|חלב/, "milk"],
  [/ביצ|חביתה|שקשוקה/, "egg"],
  [/לחם|פיתה|פסטה|שיבולת שועל|קמח|בורגול|קוסקוס|טוסט|גרנולה/, "gluten"],
  [/טופו|סויה|אדממה/, "soy"],
  [/סלמון|טונה|דג/, "fish"],
  [/בוטנים/, "peanut"],
  [/אגוז|שקד|קשיו/, "tree_nut"],
];

const text = (m: (typeof MEAL_IDEAS)[number]) => `${m.title_he} | ${m.hint_he ?? ""}`;

describe("meal ideas library", () => {
  it("has unique slugs", () => {
    expect(new Set(MEAL_IDEAS.map((r) => r.slug)).size).toBe(MEAL_IDEAS.length);
  });

  it.each(MEAL_IDEAS.map((m) => [m.slug, m] as const))("%s is an idea, not a recipe", (_, m) => {
    // No amounts, units, times or steps: the product gives ideas only.
    expect(text(m)).not.toMatch(/[0-9]|גרם|מ"ל|כפית|כפות|(^|\s)כף(\s|$)|כוס|דקות|מנות|קלוריות|שלב/);
    expect(m.title_he.length).toBeLessThanOrEqual(40);
    expect((m.hint_he ?? "").length).toBeLessThanOrEqual(60);
  });

  it.each(MEAL_IDEAS.map((m) => [m.slug, m] as const))("%s declares every allergen its text implies", (_, m) => {
    for (const [re, allergen] of ALLERGEN_HINTS) {
      if (re.test(text(m))) expect(m.allergens, `${allergen} in ${m.slug}`).toContain(allergen);
    }
  });

  it("keeps vegan ideas free of animal allergens and meat ideas free of dairy", () => {
    for (const m of MEAL_IDEAS) {
      if (m.diet.includes("vegan")) expect(m.allergens.filter((a) => ["milk", "egg", "fish", "shellfish"].includes(a))).toEqual([]);
      if (m.diet.includes("kosher_meat")) expect(m.allergens).not.toContain("milk");
      if (m.diet.includes("kosher_meat")) expect(m.diet).not.toContain("vegetarian");
    }
  });

  it("has light and common-restriction options for every meal", () => {
    for (const meal of ["breakfast", "lunch", "dinner", "snack"] as const) {
      const of = MEAL_IDEAS.filter((m) => m.meal_type.includes(meal));
      expect(of.length, meal).toBeGreaterThanOrEqual(5);
      expect(of.some((m) => m.portion === "light"), `light ${meal}`).toBe(true);
      expect(of.some((m) => m.diet.includes("vegan")), `vegan ${meal}`).toBe(true);
      expect(of.some((m) => !m.allergens.includes("gluten")), `gluten-free ${meal}`).toBe(true);
      expect(of.some((m) => m.allergens.length === 0 || (m.allergens.length === 1 && m.allergens[0] === "tree_nut")), `low-allergen ${meal}`).toBe(true);
    }
    for (const meal of ["breakfast", "lunch", "dinner"] as const) {
      expect(MEAL_IDEAS.some((m) => m.meal_type.includes(meal) && m.portion === "regular"), `regular ${meal}`).toBe(true);
    }
  });
});
