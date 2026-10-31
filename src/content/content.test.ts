import { describe, expect, it } from "vitest";
import { EQUIPMENT } from "@/lib/onboarding/schema";
import { EXERCISES } from "./exercises";
import { MUSCLES } from "./muscles";
import { RECIPES, type Allergen } from "./recipes";

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

/** Ingredient keywords that imply an allergen. A recipe must declare every allergen its ingredients imply. */
const ALLERGEN_HINTS: [RegExp, Allergen][] = [
  [/טחינה|חומוס מוכן|שומשום/, "sesame"],
  [/יוגורט|קוטג׳|גבינ|חמאה(?! בוטנים)|שמנת|(?<!משקה שיבולת שועל או )חלב/, "milk"],
  [/ביצ/, "egg"],
  [/לחם|פיתה|פסטה|שיבולת שועל|קמח|בורגול|קוסקוס/, "gluten"],
  [/טופו|סויה|אדממה/, "soy"],
  [/סלמון|טונה|דג/, "fish"],
  [/בוטנים/, "peanut"],
  [/אגוז|שקד|קשיו/, "tree_nut"],
];

describe("recipe library", () => {
  it("has unique slugs", () => {
    expect(new Set(RECIPES.map((r) => r.slug)).size).toBe(RECIPES.length);
  });

  it.each(RECIPES.map((r) => [r.slug, r] as const))("%s declares every allergen its ingredients imply", (_, r) => {
    const text = r.ingredients.map((i) => i.name_he).join(" | ");
    for (const [re, allergen] of ALLERGEN_HINTS) {
      if (re.test(text)) expect(r.allergens, `${allergen} in ${r.slug}`).toContain(allergen);
    }
  });

  it("keeps vegan recipes free of animal allergens and meat dishes free of dairy", () => {
    for (const r of RECIPES) {
      if (r.diet.includes("vegan")) expect(r.allergens.filter((a) => ["milk", "egg", "fish", "shellfish"].includes(a))).toEqual([]);
      if (r.diet.includes("kosher_meat")) expect(r.allergens).not.toContain("milk");
      if (r.diet.includes("kosher_meat")) expect(r.diet).not.toContain("vegetarian");
    }
  });

  it("has options for every meal and for common restrictions", () => {
    for (const m of ["breakfast", "lunch", "dinner", "snack"] as const) {
      expect(RECIPES.filter((r) => r.meal_type.includes(m)).length, m).toBeGreaterThanOrEqual(4);
      expect(RECIPES.some((r) => r.meal_type.includes(m) && r.diet.includes("vegan")), `vegan ${m}`).toBe(true);
      expect(RECIPES.some((r) => r.meal_type.includes(m) && !r.allergens.includes("gluten")), `gluten-free ${m}`).toBe(true);
    }
  });
});
