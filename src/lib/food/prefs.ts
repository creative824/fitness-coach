/**
 * Food taste ("בוא נכיר את הטעם שלך"): a short list of popular foods to tap, and how each one
 * maps to the foods the menu and the meal ideas are built from (src/content/menu-foods.ts).
 *
 * Three different things are kept apart:
 * - likes ("אוהב"): meals with these come first.
 * - dislikes ("לא אוהב") and never ("לא אוכל"): meals with these are not suggested.
 * - allergies: a hard rule, handled by the allergen tags of the foods (menu engine).
 */
import { FOODS, type FoodKey } from "@/content/menu-foods";

export interface TasteOption {
  name: string;
  emoji: string;
  foods: FoodKey[];
}

export interface TasteGroup {
  title: string;
  options: TasteOption[];
}

export const TASTE_GROUPS: TasteGroup[] = [
  {
    title: "חלבונים",
    options: [
      { name: "עוף", emoji: "🍗", foods: ["chicken", "pargit"] },
      { name: "בקר", emoji: "🥩", foods: ["beef"] },
      { name: "הודו", emoji: "🦃", foods: ["turkey"] },
      { name: "דגים", emoji: "🐟", foods: ["salmon", "whiteFish"] },
      { name: "טונה", emoji: "🥫", foods: ["tuna"] },
      { name: "ביצים", emoji: "🥚", foods: ["egg"] },
      { name: "גבינות", emoji: "🧀", foods: ["cottage", "whiteCheese", "yellowCheese", "feta", "labaneh"] },
      { name: "קטניות", emoji: "🫘", foods: ["lentils", "chickpeas", "whiteBeans", "hummus", "lentilSoup", "edamame"] },
    ],
  },
  {
    title: "פחמימות",
    options: [
      { name: "אורז", emoji: "🍚", foods: ["rice"] },
      { name: "תפוחי אדמה", emoji: "🥔", foods: ["potato"] },
      { name: "פסטה", emoji: "🍝", foods: ["pasta"] },
      { name: "לחם", emoji: "🍞", foods: ["bread"] },
      { name: "פיתות", emoji: "🫓", foods: ["pita", "tortilla"] },
      { name: "קוסקוס", emoji: "🥣", foods: ["couscous"] },
      { name: "בטטה", emoji: "🍠", foods: ["sweetPotato"] },
    ],
  },
  {
    title: "ירקות",
    options: [
      { name: "מלפפון", emoji: "🥒", foods: [] },
      { name: "עגבנייה", emoji: "🍅", foods: ["tomatoSauce"] },
      { name: "חסה", emoji: "🥬", foods: [] },
      { name: "כרוב", emoji: "🥬", foods: [] },
      { name: "גזר", emoji: "🥕", foods: [] },
      { name: "פלפל", emoji: "🫑", foods: [] },
      { name: "ברוקולי", emoji: "🥦", foods: ["cookedVeg"] },
    ],
  },
  {
    title: "פירות",
    options: [
      { name: "בננה", emoji: "🍌", foods: ["banana"] },
      { name: "תפוח", emoji: "🍎", foods: ["apple"] },
      { name: "אבטיח", emoji: "🍉", foods: [] },
      { name: "ענבים", emoji: "🍇", foods: [] },
      { name: "תותים", emoji: "🍓", foods: ["berries"] },
      { name: "תפוז", emoji: "🍊", foods: [] },
    ],
  },
  {
    title: "תוספות ומאכלים",
    options: [
      { name: "טחינה", emoji: "🥄", foods: ["tahini"] },
      { name: "אבוקדו", emoji: "🥑", foods: ["avocado"] },
      { name: "אגוזים", emoji: "🥜", foods: ["almonds", "walnuts"] },
      { name: "חמאת בוטנים", emoji: "🥜", foods: ["peanutButter"] },
      { name: "שמן זית", emoji: "🫒", foods: ["oil"] },
    ],
  },
];

export const TASTE_OPTIONS = TASTE_GROUPS.flatMap((g) => g.options);
const BY_NAME = new Map(TASTE_OPTIONS.map((o) => [o.name, o]));

const clean = (s: string) => s.replace(/['"׳״]/g, "").trim();

/**
 * The menu foods a taste word stands for: the popular options by name, and any free text
 * ("סלמון", "קוטג׳") by the foods whose name contains it.
 */
export function foodsFor(word: string): FoodKey[] {
  const w = clean(word);
  if (w.length < 2) return [];
  const known = BY_NAME.get(w);
  if (known) return known.foods;
  return (Object.keys(FOODS) as FoodKey[]).filter((k) => clean(FOODS[k].name).includes(w));
}

export interface Taste {
  likes: string[];
  dislikes: string[];
  never: string[];
}

/** Foods never to suggest: everything the user does not like or does not eat. */
export function blockedFoods(t: Pick<Taste, "dislikes" | "never">): Set<FoodKey> {
  return new Set([...t.dislikes, ...t.never].flatMap(foodsFor));
}

export function likedFoods(t: Pick<Taste, "likes">): Set<FoodKey> {
  return new Set(t.likes.flatMap(foodsFor));
}

export const TASTE_LIMIT = 40;
