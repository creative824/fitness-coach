import { describe, expect, it } from "vitest";
import { MENU_MEALS } from "@/content/menu-meals";
import { FOODS } from "@/content/menu-foods";
import { ideaBySlug, ideaItems, ideaKcal, plannedOf, suggestIdeas, IDEA_SIZES, type IdeaInput } from "./ideas";
import { blockedFoods, foodsFor } from "./prefs";

const base: IdeaInput = {
  size: "medium",
  target: 2000,
  eatenKcal: 900,
  proteinTarget: 120,
  eatenProtein: 50,
  profile: { pattern: "omnivore", allergies: [], avoid: [] },
  taste: { likes: [], dislikes: [], never: [] },
  minutes: 13 * 60,
  seed: 7,
};

const parts = (slug: string) => MENU_MEALS.find((m) => m.slug === slug)!.parts.map((p) => p.food);
const names = (slug: string) => {
  const m = MENU_MEALS.find((x) => x.slug === slug)!;
  return [m.title, ...m.parts.map((p) => FOODS[p.food].name)].join(" ");
};

describe("taste words", () => {
  it("maps popular foods and free text to menu foods", () => {
    expect(foodsFor("דגים")).toEqual(["salmon", "whiteFish"]);
    expect(foodsFor("גבינות")).toContain("cottage");
    expect(foodsFor("סלמון")).toEqual(["salmon"]);
    expect(blockedFoods({ dislikes: ["טונה"], never: ["בקר"] })).toEqual(new Set(["tuna", "beef"]));
  });
});

describe("meal ideas: light, medium or a large meal", () => {
  it("light is up to about 250, medium about 400, large about 600, a little over at most", () => {
    const caps = { light: 250, medium: 400, large: 600 };
    for (const size of IDEA_SIZES) {
      const { ideas } = suggestIdeas({ ...base, size, eatenKcal: 0 });
      expect(ideas.length, size).toBeGreaterThanOrEqual(3);
      for (const i of ideas) expect(i.meal.kcal, `${size} ${i.slug}`).toBeLessThanOrEqual(caps[size] * 1.12);
    }
    expect(ideaKcal({ size: "light", target: 2000, eatenKcal: 0 }).kcal).toBeLessThanOrEqual(250);
  });

  it("gives less when little is left today, but a large meal stays a meal", () => {
    expect(ideaKcal({ size: "large", target: 2000, eatenKcal: 1700 }).kcal).toBe(400);
    expect(ideaKcal({ size: "medium", target: 2000, eatenKcal: 1700 }).kcal).toBe(300);
  });

  it("never suggests tofu to someone who does not like tofu", () => {
    for (const size of IDEA_SIZES) {
      const { ideas } = suggestIdeas({ ...base, size, profile: { pattern: "vegan", allergies: [], avoid: [] }, taste: { likes: [], dislikes: ["טופו"], never: [] } });
      for (const i of ideas) {
        expect(parts(i.slug), i.slug).not.toContain("tofu");
        expect(names(i.slug), i.slug).not.toContain("טופו");
      }
    }
  });

  it("never suggests fish to someone who does not like fish, or cheese to someone who does not eat it", () => {
    for (const size of IDEA_SIZES) {
      const { ideas } = suggestIdeas({ ...base, size, taste: { likes: [], dislikes: ["דגים"], never: ["גבינות"] } });
      for (const i of ideas) {
        const f = parts(i.slug);
        expect(f.some((x) => x === "salmon" || x === "whiteFish"), i.slug).toBe(false);
        expect(f.some((x) => ["cottage", "whiteCheese", "yellowCheese", "feta", "labaneh"].includes(x)), i.slug).toBe(false);
      }
    }
  });

  it("treats an allergy as a hard rule", () => {
    const { ideas } = suggestIdeas({ ...base, minutes: 8 * 60, profile: { ...base.profile, allergies: ["egg", "milk"] } });
    for (const i of ideas) for (const f of parts(i.slug)) expect(FOODS[f].tags as string[]).not.toContain("egg");
    for (const i of ideas) for (const f of parts(i.slug)) expect(FOODS[f].tags as string[]).not.toContain("milk");
  });

  it("puts liked foods first", () => {
    const { ideas } = suggestIdeas({ ...base, size: "large", taste: { likes: ["עוף", "אורז"], dislikes: [], never: [] } });
    expect(ideas.slice(0, 3).every((i) => i.liked)).toBe(true);
  });

  it("a chosen idea is rebuilt with the same numbers, and not at all once the user stops liking it", () => {
    const i = suggestIdeas(base).ideas[0];
    expect(ideaBySlug(i.slug, i.kcal, base.profile, base.taste)?.meal.kcal).toBe(i.meal.kcal);
    const main = parts(i.slug).find((f) => FOODS[f].name.length > 2)!;
    expect(ideaBySlug(i.slug, i.kcal, base.profile, { likes: [], dislikes: [FOODS[main].name], never: [] })).toBeNull();
  });

  it("logs an idea with the amounts as numbers, so they can be changed", () => {
    const i = suggestIdeas(base).ideas[0];
    expect(ideaItems(i.meal, true).every((x) => x.kcal_min !== null && x.quantity !== null)).toBe(true);
    expect(ideaItems(i.meal, false).every((x) => x.kcal_min === null)).toBe(true);
  });

  it("keeps only today's picked dishes", () => {
    const list = [
      { id: "a", slug: "x", kcal: 400, date: "2026-11-27" },
      { id: "b", slug: "y", kcal: 400, date: "2026-11-26" },
      { id: "c", slug: "z", kcal: 5000, date: "2026-11-27" },
    ];
    expect(plannedOf(list, "2026-11-27").map((x) => x.id)).toEqual(["a"]);
    expect(plannedOf("nope", "2026-11-27")).toEqual([]);
  });
});
