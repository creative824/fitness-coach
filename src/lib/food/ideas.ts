/**
 * "תן לי רעיון למנה": the user picks only how big (light, medium, large) and gets 3–5 dishes
 * that fit their taste, allergies and what is left of the day. Built from the meals and food
 * values of src/content (menu-meals.ts, menu-foods.ts), so the numbers are counted in code.
 * Pure, so it runs in the browser right away and in tests.
 *
 * An idea is never food eaten: it is counted only when the user says "אכלתי את המנה".
 */
import { FOODS, type FoodKey } from "@/content/menu-foods";
import { MENU_MEALS, type MenuMeal, type SlotType } from "@/content/menu-meals";
import { allowedFor, renderMeal, scaleFor, seedFrom, type DietProfile, type RenderedMeal } from "@/lib/menu/engine";
import { blockedFoods, likedFoods, type Taste } from "./prefs";

export const IDEA_SIZES = ["light", "medium", "large"] as const;
export type IdeaSize = (typeof IDEA_SIZES)[number];

export const IDEA_SIZE_LABEL: Record<IdeaSize, string> = { light: "קלילה (ביניים)", medium: "בינונית", large: "ארוחה גדולה" };
export const IDEA_SIZE_EMOJI: Record<IdeaSize, string> = { light: "🍎", medium: "🥗", large: "🍲" };
/** About how many calories each size is: "up to" this, a little more for a good fit. */
export const IDEA_SIZE_KCAL: Record<IdeaSize, number> = { light: 250, medium: 400, large: 600 };
/** Below this, a size stops being itself (a "large meal" of 200 kcal). */
const FLOOR: Record<IdeaSize, number> = { light: 120, medium: 250, large: 400 };
/** How far over the size a dish may go when it fits well. */
const OVER = 1.12;

export interface IdeaInput {
  size: IdeaSize;
  /** The day's calorie target, or null without numbers. */
  target: number | null;
  eatenKcal: number;
  proteinTarget: number | null;
  eatenProtein: number;
  profile: DietProfile;
  taste: Taste;
  /** Minutes since midnight: a medium dish at 8:00 is a breakfast, at 13:00 a lunch. */
  minutes: number;
  seed: number;
}

export interface Idea {
  slug: string;
  title: string;
  emoji: string;
  prepMinutes: number;
  /** The calories the dish was sized for (kept with a chosen idea, so the numbers stay the same). */
  kcal: number;
  meal: RenderedMeal;
  liked: boolean;
}

/** The calories to size dishes for: the size, but not much more than is left today. */
export function ideaKcal(input: Pick<IdeaInput, "size" | "target" | "eatenKcal">): { kcal: number; left: number | null } {
  const want = IDEA_SIZE_KCAL[input.size] - 20;
  if (!input.target) return { kcal: want, left: null };
  const left = input.target - input.eatenKcal;
  return { kcal: Math.max(FLOOR[input.size], Math.min(want, left)), left };
}

const daySlot = (minutes: number): SlotType => (minutes < 11 * 60 ? "breakfast" : minutes < 17 * 60 ? "lunch" : "dinner");

function slotsFor(size: IdeaSize): SlotType[] {
  if (size === "light") return ["snack", "breakfast"];
  if (size === "medium") return ["breakfast", "lunch", "dinner", "snack"];
  return ["lunch", "dinner", "breakfast"];
}

/**
 * The dish with what the user does not eat taken out: a side salad goes when they do not like
 * vegetables; a dish whose main food they do not eat is not offered at all (see `allowed`).
 */
function withoutSides(meal: MenuMeal, blocked: Set<FoodKey>): MenuMeal {
  const parts = meal.parts.filter((p) => !(p.fixed && blocked.has(p.food)));
  return parts.length === meal.parts.length ? meal : { ...meal, parts };
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

/** The filter of the questionnaire: allergies, diet, "לא אוהב" and "לא אוכל" are hard rules. */
function tasteFilter(profile: DietProfile, taste: Taste) {
  const avoid = [...profile.avoid, ...taste.dislikes, ...taste.never];
  const ok = allowedFor({ ...profile, avoid });
  const blocked = new Set([...blockedFoods(taste), ...blockedFoods({ dislikes: profile.avoid, never: [] })]);
  return (meal: MenuMeal): MenuMeal | null => {
    const m = withoutSides(meal, blocked);
    if (m.parts.some((p) => blocked.has(p.food))) return null;
    return ok(m) ? m : null;
  };
}

/**
 * Every fitting dish, best first. The UI shows four and "תן לי עוד רעיונות" moves to the next.
 * Liked foods, protein still missing and the time of day order them, with a little variety.
 */
export function suggestIdeas(input: IdeaInput): { kcal: number; left: number | null; ideas: Idea[] } {
  const { kcal, left } = ideaKcal(input);
  const cap = Math.max(kcal, IDEA_SIZE_KCAL[input.size]) * OVER;
  const fit = tasteFilter(input.profile, input.taste);
  const liked = likedFoods(input.taste);
  const likedWords = input.taste.likes.filter((w) => w.length >= 2);
  const slots = slotsFor(input.size);
  const now = daySlot(input.minutes);
  const proteinLeft = input.proteinTarget ? Math.max(0, input.proteinTarget - input.eatenProtein) : 0;
  const r = rng(input.seed ^ seedFrom(input.size));

  const scored = MENU_MEALS.flatMap((raw) => {
    if (!raw.slots.some((s) => slots.includes(s))) return [];
    const m = fit(raw);
    if (!m) return [];
    const meal = renderMeal(m, kcal);
    // Portions far from how the dish is written look odd (a tiny steak, a huge snack).
    const scale = scaleFor(m, kcal);
    if (scale < 0.55 || scale > 1.9 || meal.kcal > cap || meal.kcal < kcal * 0.7) return [];
    const likedHit = m.parts.some((p) => liked.has(p.food)) || likedWords.some((w) => m.title.includes(w));
    let score = r() * 1.5;
    if (likedHit) score += 3;
    if (input.size !== "light" && m.slots.includes(now)) score += 2;
    if (input.size === "light" && m.slots.includes("snack")) score += 1.5;
    score -= Math.abs(meal.kcal - kcal) / kcal;
    if (proteinLeft > 25) score += ((meal.protein * 4) / Math.max(1, meal.kcal)) * 6;
    const idea: Idea = { slug: m.slug, title: m.title, emoji: emojiOf(m), prepMinutes: prepMinutes(m), kcal, meal, liked: likedHit };
    return [{ idea, score }];
  }).sort((a, b) => b.score - a.score);

  return { kcal, left, ideas: varied(scored.map((x) => x.idea)) };
}

/** The main food of a dish (chicken, eggs, tuna...): the part that gives the most protein. */
function mainOf(slug: string): FoodKey | undefined {
  const parts = MENU_MEALS.find((m) => m.slug === slug)?.parts ?? [];
  return [...parts].sort((a, b) => FOODS[b.food].p * b.qty - FOODS[a.food].p * a.qty)[0]?.food;
}

/** Best first, but not four chicken dishes in a row: the same main food waits for the next round. */
function varied(ideas: Idea[]): Idea[] {
  const out: Idea[] = [];
  const rest = [...ideas];
  while (rest.length) {
    const recent = new Set(out.slice(-2).map((i) => mainOf(i.slug)));
    const k = rest.findIndex((i) => !recent.has(mainOf(i.slug)));
    out.push(...rest.splice(k < 0 ? 0 : k, 1));
  }
  return out;
}

/** One dish again, sized as it was shown (for "אכלתי את המנה" on the server). Null if it no longer fits the user's taste. */
export function ideaBySlug(slug: string, kcal: number, profile: DietProfile, taste: Taste): Idea | null {
  const raw = MENU_MEALS.find((x) => x.slug === slug);
  const m = raw ? tasteFilter(profile, taste)(raw) : null;
  if (!m) return null;
  return { slug: m.slug, title: m.title, emoji: emojiOf(m), prepMinutes: prepMinutes(m), kcal, meal: renderMeal(m, kcal), liked: false };
}

/** The items of a dish, as food log items (what "אכלתי את המנה" saves). */
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

/** A dish the user picked to maybe eat later today. Kept in profiles.preferences.planned_ideas, never counted. */
export interface PlannedIdea {
  id: string;
  slug: string;
  kcal: number;
  date: string;
}

export function plannedOf(v: unknown, today: string): PlannedIdea[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (x): x is PlannedIdea =>
        x && typeof x.id === "string" && typeof x.slug === "string" && typeof x.kcal === "number" && x.kcal >= 80 && x.kcal <= 900 && x.date === today,
    )
    .slice(0, 10);
}
