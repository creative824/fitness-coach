/**
 * "תן לי רעיון לארוחה": 3–5 meals that fit the user's taste, allergies and what is left of the
 * day's calories and protein. Built from the same meals and food values as the daily menu
 * (src/content/menu-meals.ts, menu-foods.ts), so the numbers are counted in code, not guessed.
 * Pure, so it runs in the browser right away and in tests.
 */
import { FOODS, type FoodKey } from "@/content/menu-foods";
import { MENU_MEALS, type MenuMeal, type SlotType } from "@/content/menu-meals";
import { allowedFor, renderMeal, scaleFor, seedFrom, type DietProfile, type RenderedMeal } from "@/lib/menu/engine";
import { likedFoods, type Taste } from "./prefs";

export const IDEA_KINDS = ["breakfast", "lunch", "dinner", "snack", "sweet", "protein"] as const;
export type IdeaKind = (typeof IDEA_KINDS)[number];

export const IDEA_KIND_LABEL: Record<IdeaKind, string> = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  snack: "ארוחת ביניים",
  sweet: "משהו קטן ומתוק",
  protein: "ארוחה עשירה בחלבון",
};
export const IDEA_KIND_EMOJI: Record<IdeaKind, string> = {
  breakfast: "🍳",
  lunch: "🍲",
  dinner: "🥗",
  snack: "🍎",
  sweet: "🍫",
  protein: "💪",
};

export const SIZES = ["small", "regular", "large"] as const;
export type Size = (typeof SIZES)[number];
export const SIZE_LABEL: Record<Size, string> = { small: "מנה קטנה", regular: "מנה רגילה", large: "מנה גדולה" };
const SIZE_FACTOR: Record<Size, number> = { small: 0.75, regular: 1, large: 1.3 };

/** A usual share of the day for each kind of meal. */
const SHARE: Record<IdeaKind, number> = { breakfast: 0.25, lunch: 0.33, dinner: 0.28, snack: 0.1, sweet: 0.08, protein: 0.3 };
const FLOOR: Record<IdeaKind, number> = { breakfast: 250, lunch: 350, dinner: 300, snack: 120, sweet: 100, protein: 250 };
const CEIL: Record<IdeaKind, number> = { breakfast: 650, lunch: 850, dinner: 750, snack: 300, sweet: 250, protein: 800 };

const SWEET: Set<FoodKey> = new Set(["fruit", "banana", "apple", "dates", "honey", "darkChocolate", "berries", "granola", "proteinPudding"]);
const SAVORY_MAIN: Set<FoodKey> = new Set(["chicken", "beef", "tuna", "salmon", "whiteFish", "pargit", "turkey", "hummus", "lentils", "tofu"]);

export interface IdeaInput {
  kind: IdeaKind;
  /** The day's calorie target, or null without numbers (a neutral 2000 is used to size meals). */
  target: number | null;
  eatenKcal: number;
  proteinTarget: number | null;
  eatenProtein: number;
  profile: DietProfile;
  taste: Taste;
  /** Minutes since midnight, for "protein" (which meal of the day it is). */
  minutes: number;
  seed: number;
}

export interface Idea {
  slug: string;
  title: string;
  emoji: string;
  prepMinutes: number;
  /** The calories the regular portion is sized for. */
  baseKcal: number;
  sizes: Record<Size, RenderedMeal>;
  /** The size that fits what is left today. */
  suggested: Size;
  liked: boolean;
}

const slotsFor = (kind: IdeaKind, minutes: number): SlotType[] => {
  if (kind === "breakfast" || kind === "lunch" || kind === "dinner" || kind === "snack") return [kind];
  if (kind === "sweet") return ["snack", "breakfast"];
  // High protein: the meal of this time of day.
  return minutes < 11 * 60 ? ["breakfast"] : minutes < 17 * 60 ? ["lunch"] : ["dinner"];
};

function suitsKind(meal: MenuMeal, kind: IdeaKind): boolean {
  const foods = meal.parts.map((p) => p.food);
  if (kind === "sweet") return foods.some((f) => SWEET.has(f)) && !foods.some((f) => SAVORY_MAIN.has(f) || f === "egg");
  if (kind === "protein") {
    const r = renderMeal(meal, 400);
    return (r.protein * 4) / Math.max(1, r.kcal) >= 0.27;
  }
  return true;
}

/** Rough minutes to make it: cooking a main takes longer than spreading a slice. */
export function prepMinutes(meal: MenuMeal): number {
  const foods = new Set(meal.parts.map((p) => p.food));
  const has = (...k: FoodKey[]) => k.some((x) => foods.has(x));
  if (has("lentilSoup", "vegSoup", "whiteBeans")) return 35;
  if (has("chicken", "beef", "salmon", "whiteFish", "pargit")) return has("rice", "quinoa", "bulgur", "potato", "sweetPotato", "buckwheat", "couscous") ? 30 : 20;
  if (has("rice", "quinoa", "pasta", "bulgur", "couscous", "buckwheat", "potato", "sweetPotato", "lentils")) return 20;
  if (has("tofu", "oats", "tomatoSauce")) return 15;
  if (has("egg")) return 10;
  return 5;
}

const EMOJI: [FoodKey | RegExp, string][] = [
  [/שקשוקה/, "🍳"],
  [/מרק/, "🍲"],
  [/שייק/, "🥤"],
  [/פנקייק/, "🥞"],
  [/פסטה/, "🍝"],
  [/טורטייה|כריך/, "🌯"],
  [/פיתה|סביח/, "🫓"],
  [/פופקורן/, "🍿"],
  [/שוקולד/, "🍫"],
  ["salmon", "🍣"],
  ["whiteFish", "🐟"],
  ["tuna", "🐟"],
  ["chicken", "🍗"],
  ["pargit", "🍗"],
  ["beef", "🥩"],
  ["egg", "🥚"],
  ["yogurt", "🥣"],
  ["oats", "🥣"],
  ["cottage", "🧀"],
  ["feta", "🧀"],
  ["tofu", "🥢"],
  ["rice", "🍚"],
  ["lentils", "🫘"],
  ["chickpeas", "🫘"],
  ["edamame", "🫛"],
  ["almonds", "🥜"],
  ["walnuts", "🥜"],
  ["apple", "🍎"],
  ["banana", "🍌"],
  ["berries", "🫐"],
  ["fruit", "🍑"],
  ["dates", "🌴"],
  ["cornCob", "🌽"],
  ["bread", "🍞"],
  ["salad", "🥗"],
];

export function emojiOf(meal: MenuMeal): string {
  const foods = new Set(meal.parts.map((p) => p.food));
  for (const [k, e] of EMOJI) if (typeof k === "string" ? foods.has(k) : k.test(meal.title)) return e;
  return "🍽️";
}

/** The calories a regular portion is sized for: the usual share, but not more than is left. */
export function portionKcal(input: Pick<IdeaInput, "kind" | "target" | "eatenKcal">): { kcal: number; left: number | null } {
  const day = input.target ?? 2000;
  const usual = Math.round(day * SHARE[input.kind]);
  if (!input.target) return { kcal: clamp(usual, FLOOR[input.kind], CEIL[input.kind]), left: null };
  const left = input.target - input.eatenKcal;
  const kcal = clamp(Math.min(usual, Math.max(left, FLOOR[input.kind])), FLOOR[input.kind], CEIL[input.kind]);
  return { kcal, left };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Every fitting meal, best first. The UI shows the first three and "תן לי משהו אחר" moves to
 * the next. Allergies, diet, dislikes and "never" foods are hard filters (via the menu engine);
 * liked foods, protein still missing and a little variety order the rest.
 */
export function suggestIdeas(input: IdeaInput): Idea[] {
  const { kcal, left } = portionKcal(input);
  const ok = allowedFor({ ...input.profile, avoid: [...input.profile.avoid, ...input.taste.dislikes, ...input.taste.never] });
  const liked = likedFoods(input.taste);
  const likedWords = input.taste.likes.filter((w) => w.length >= 2);
  const slots = slotsFor(input.kind, input.minutes);
  const proteinLeft = input.proteinTarget ? Math.max(0, input.proteinTarget - input.eatenProtein) : 0;
  const r = rng(input.seed ^ seedFrom(input.kind));

  const scored = MENU_MEALS.filter((m) => m.slots.some((s) => slots.includes(s)) && ok(m) && suitsKind(m, input.kind))
    .map((m) => {
      const regular = renderMeal(m, kcal);
      const scale = scaleFor(m, kcal);
      const likedHit = m.parts.some((p) => liked.has(p.food)) || likedWords.some((w) => m.title.includes(w));
      let score = r() * 1.5;
      if (likedHit) score += 3;
      // Portions far from how the meal is written look odd (a tiny steak, a huge snack).
      if (scale < 0.55 || scale > 1.9) score -= 4;
      if (Math.abs(regular.kcal - kcal) > kcal * 0.25) score -= 2;
      // More protein first when a lot is still missing, or when that is what was asked for.
      const density = (regular.protein * 4) / Math.max(1, regular.kcal);
      if (input.kind === "protein" || proteinLeft > 30) score += density * 6;
      return { m, score, likedHit };
    })
    .sort((a, b) => b.score - a.score);

  return scored.map(({ m, likedHit }) => {
    const sizes = Object.fromEntries(SIZES.map((s) => [s, renderMeal(m, Math.round(kcal * SIZE_FACTOR[s]))])) as Record<Size, RenderedMeal>;
    let suggested: Size = "regular";
    if (left !== null && sizes.regular.kcal > left + 50) suggested = "small";
    return { slug: m.slug, title: m.title, emoji: emojiOf(m), prepMinutes: prepMinutes(m), baseKcal: kcal, sizes, suggested, liked: likedHit };
  });
}

/** An idea the user saved, rebuilt with today's numbers. */
export function ideaBySlug(slug: string, input: Omit<IdeaInput, "seed">): Idea | null {
  const m = MENU_MEALS.find((x) => x.slug === slug);
  if (!m) return null;
  const { kcal, left } = portionKcal(input);
  const sizes = Object.fromEntries(SIZES.map((s) => [s, renderMeal(m, Math.round(kcal * SIZE_FACTOR[s]))])) as Record<Size, RenderedMeal>;
  return {
    slug: m.slug,
    title: m.title,
    emoji: emojiOf(m),
    prepMinutes: prepMinutes(m),
    baseKcal: kcal,
    sizes,
    suggested: left !== null && sizes.regular.kcal > left + 50 ? "small" : "regular",
    liked: false,
  };
}

/** The items of a chosen idea, as food log items (what "אכלתי את זה" saves). */
export function ideaItems(meal: RenderedMeal, withNumbers: boolean) {
  return meal.items.map((it) => {
    // "גרם אורז מבושל" is kept as 150 · גרם · אורז מבושל, so the amount can be changed later.
    const w = /^(גרם|מ״ל) (.+)$/.exec(it.name);
    return {
    item_name: (w ? w[2] : it.name).slice(0, 120),
    quantity: it.qty,
    unit: w ? w[1] : null,
    preparation: null,
    kcal_min: withNumbers ? it.kcal : null,
    kcal_max: withNumbers ? it.kcal : null,
    protein_g: withNumbers ? it.protein : null,
    carbs_g: withNumbers ? it.carbs : null,
    fat_g: withNumbers ? it.fat : null,
    confidence: withNumbers ? ("medium" as const) : null,
    };
  });
}

export { FOODS };
