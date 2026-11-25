import { describe, expect, it } from "vitest";
import { MENU_MEALS } from "@/content/menu-meals";
import { FOODS } from "@/content/menu-foods";
import { ideaItems, portionKcal, suggestIdeas, type IdeaInput } from "./ideas";
import { blockedFoods, foodsFor } from "./prefs";

const base: IdeaInput = {
  kind: "lunch",
  target: 2000,
  eatenKcal: 1350,
  proteinTarget: 120,
  eatenProtein: 75,
  profile: { pattern: "omnivore", allergies: [], avoid: [] },
  taste: { likes: [], dislikes: [], never: [] },
  minutes: 13 * 60,
  seed: 7,
};

const parts = (slug: string) => MENU_MEALS.find((m) => m.slug === slug)!.parts.map((p) => p.food);

describe("taste words", () => {
  it("maps popular foods and free text to menu foods", () => {
    expect(foodsFor("דגים")).toEqual(["salmon", "whiteFish"]);
    expect(foodsFor("גבינות")).toContain("cottage");
    expect(foodsFor("סלמון")).toEqual(["salmon"]);
    expect(blockedFoods({ dislikes: ["טונה"], never: ["בקר"] })).toEqual(new Set(["tuna", "beef"]));
  });
});

describe("meal ideas", () => {
  it("fits what is left today: 650 kcal left, lunch is sized at most to that", () => {
    expect(portionKcal(base).kcal).toBe(650);
    const ideas = suggestIdeas(base);
    expect(ideas.length).toBeGreaterThanOrEqual(3);
    for (const i of ideas.slice(0, 3)) expect(i.sizes.regular.kcal).toBeLessThanOrEqual(760);
  });

  it("never suggests fish to someone who does not like fish, or cheese to someone who does not eat it", () => {
    const ideas = suggestIdeas({ ...base, taste: { likes: [], dislikes: ["דגים"], never: ["גבינות"] } });
    for (const i of ideas) {
      const f = parts(i.slug);
      expect(f.some((x) => x === "salmon" || x === "whiteFish"), i.slug).toBe(false);
      expect(f.some((x) => ["cottage", "whiteCheese", "yellowCheese", "feta", "labaneh"].includes(x)), i.slug).toBe(false);
    }
  });

  it("treats an allergy as a hard rule", () => {
    const ideas = suggestIdeas({ ...base, kind: "breakfast", profile: { ...base.profile, allergies: ["egg", "milk"] } });
    for (const i of ideas) for (const f of parts(i.slug)) expect(FOODS[f].tags as string[]).not.toContain("egg");
    for (const i of ideas) for (const f of parts(i.slug)) expect(FOODS[f].tags as string[]).not.toContain("milk");
  });

  it("puts liked foods first", () => {
    const ideas = suggestIdeas({ ...base, taste: { likes: ["עוף", "אורז"], dislikes: [], never: [] } });
    expect(ideas.slice(0, 3).every((i) => i.liked)).toBe(true);
    expect(ideas.slice(0, 3).some((i) => parts(i.slug).includes("chicken") || parts(i.slug).includes("pargit"))).toBe(true);
  });

  it("offers small / regular / large and suggests the size that fits", () => {
    const ideas = suggestIdeas({ ...base, eatenKcal: 1650 });
    const i = ideas[0];
    expect(i.sizes.small.kcal).toBeLessThan(i.sizes.regular.kcal);
    expect(i.sizes.regular.kcal).toBeLessThan(i.sizes.large.kcal);
    expect(["small", "regular"]).toContain(i.suggested);
  });

  it("small and sweet means something sweet, and protein means protein", () => {
    for (const i of suggestIdeas({ ...base, kind: "sweet" })) expect(i.sizes.regular.kcal).toBeLessThan(320);
    for (const i of suggestIdeas({ ...base, kind: "protein" }).slice(0, 3)) expect((i.sizes.regular.protein * 4) / i.sizes.regular.kcal).toBeGreaterThan(0.25);
  });

  it("logs an idea with the amounts as numbers, so they can be changed", () => {
    const i = suggestIdeas(base)[0];
    const items = ideaItems(i.sizes.regular, true);
    expect(items.every((x) => x.kcal_min !== null && x.quantity !== null)).toBe(true);
    expect(ideaItems(i.sizes.regular, false).every((x) => x.kcal_min === null)).toBe(true);
  });
});
