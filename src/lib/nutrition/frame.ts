/**
 * Flexible meal framework (follow-up spec §6). The default is not a recipe but a frame: which
 * food groups to combine, a rough calorie range when there is a sound basis for one, and
 * examples that fit this user. Examples are filtered by diet, allergies, sensitivities and
 * dislikes, so two users never get the same fixed list.
 */
import type { OnboardingDraft } from "@/lib/onboarding/schema";

export type Slot = "breakfast" | "lunch" | "dinner" | "snack";

/** Relative share of the day's energy. Normalised over the slots of the day. */
const SHARE: Record<Slot, number> = { breakfast: 25, lunch: 35, dinner: 30, snack: 10 };

const round50 = (n: number) => Math.round(n / 50) * 50;

/**
 * Estimated calories per meal, only when the plan has a daily range. Returned as a range,
 * never a single number.
 */
export function mealRanges(slots: Slot[], daily: [number, number] | null): ([number, number] | null)[] {
  if (!daily || !slots.length) return slots.map(() => null);
  const total = slots.reduce((s, x) => s + SHARE[x], 0);
  return slots.map((x) => {
    const f = SHARE[x] / total;
    const lo = round50(daily[0] * f);
    const hi = Math.max(lo + 50, round50(daily[1] * f));
    return [lo, hi];
  });
}

type Tag = "egg" | "milk" | "meat" | "fish" | "soy" | "sesame" | "tree_nut" | "peanut" | "gluten";
interface Food {
  he: string;
  tags: Tag[];
}

const PROTEIN: Food[] = [
  { he: "ביצים", tags: ["egg"] },
  { he: "יוגורט או קוטג׳", tags: ["milk"] },
  { he: "גבינה לבנה", tags: ["milk"] },
  { he: "עוף או הודו", tags: ["meat"] },
  { he: "דג", tags: ["fish"] },
  { he: "טונה", tags: ["fish"] },
  { he: "עדשים, חומוס או שעועית", tags: [] },
  { he: "טופו", tags: ["soy"] },
  { he: "אדממה", tags: ["soy"] },
];
const CARB: Food[] = [
  { he: "לחם מלא", tags: ["gluten"] },
  { he: "שיבולת שועל", tags: ["gluten"] },
  { he: "פסטה מלאה", tags: ["gluten"] },
  { he: "אורז מלא", tags: [] },
  { he: "בטטה או תפוח אדמה", tags: [] },
  { he: "כוסמת או קינואה", tags: [] },
];
const FAT: Food[] = [
  { he: "טחינה", tags: ["sesame"] },
  { he: "אגוזים", tags: ["tree_nut"] },
  { he: "חמאת בוטנים", tags: ["peanut"] },
  { he: "אבוקדו", tags: [] },
  { he: "שמן זית", tags: [] },
];
const VEG = ["סלט ירקות", "ירקות מבושלים או אפויים", "ירקות חתוכים"];
const FRUIT = ["פרי", "פירות יער", "תמרים מעטים"];

function allowed(d: OnboardingDraft): (f: Food) => boolean {
  // Shellfish is in none of the lists, so it needs no tag.
  const block = new Set<Tag>(d.allergies.filter((a) => a !== "shellfish"));
  if (d.dietary_pattern === "vegan") for (const t of ["egg", "milk", "meat", "fish"] as Tag[]) block.add(t);
  if (d.dietary_pattern === "vegetarian") for (const t of ["meat", "fish"] as Tag[]) block.add(t);
  if (d.dietary_pattern === "pescatarian") block.add("meat");
  const avoid = [...d.dislikes, ...d.sensitivities].map((x) => x.trim()).filter((x) => x.length >= 2);
  return (f) => !f.tags.some((t) => block.has(t)) && !avoid.some((a) => f.he.includes(a));
}

const pick = <T,>(xs: T[], n: number, offset: number) => (xs.length ? Array.from({ length: Math.min(n, xs.length) }, (_, i) => xs[(i + offset) % xs.length]) : []);

export type GoalKind = "lose" | "gain" | "maintain" | "habits";

export function goalKind(d: OnboardingDraft): GoalKind {
  const g = d.goals[0];
  if (g === "lose_weight") return "lose";
  if (g === "muscle" || g === "gain_weight" || g === "strength") return "gain";
  if (g === "habits") return "habits";
  return "maintain";
}

/** The guidance line for the user's goal (spec §6 table). No extreme restriction in any of them. */
export const GOAL_GUIDE: Record<GoalKind, string> = {
  lose: "מסגרת מתונה ומאוזנת: הרבה ירקות, חלבון וסיבים לשובע, בלי הגבלה קיצונית ובלי לדלג על ארוחות.",
  gain: "מספיק אנרגיה, חלבון בכל ארוחה ופחמימות שתומכות באימונים, בפיזור נוח לאורך היום.",
  maintain: "תזונה מאוזנת ומגוונת, שמותאמת לפעילות ולשגרה שלך.",
  habits: "מתמקדים בהרכב הצלחת, בשתייה ובסדירות, ולא בספירה של כל דבר.",
};

export interface MealFrame {
  /** Food groups to combine, in plain words. */
  groups: string[];
  /** Examples that fit this user, by group. */
  examples: string[];
}

export function mealFrame(slot: Slot, d: OnboardingDraft, kind: GoalKind, dayIndex = 0): MealFrame {
  const ok = allowed(d);
  const protein = PROTEIN.filter(ok).map((f) => f.he);
  const carb = CARB.filter(ok).map((f) => f.he);
  const fat = FAT.filter(ok).map((f) => f.he);
  const carbAmount = kind === "gain" ? "מנה נדיבה" : kind === "lose" ? "מנה מתונה" : "לפי הרעב";
  const o = dayIndex;

  switch (slot) {
    case "breakfast":
      return {
        groups: ["ירקות או פרי", "מקור חלבון", "שומן איכותי", kind === "gain" ? "פחמימה מלאה" : "פחמימה מלאה, אם מתחשק"],
        examples: [...pick(protein, 2, o), ...pick(VEG.concat(FRUIT), 1, o), ...pick(fat, 1, o), ...pick(carb, 1, o)],
      };
    case "lunch":
      return {
        groups: [kind === "lose" ? "חצי צלחת ירקות" : "ירקות", "מקור חלבון", `פחמימה, ${carbAmount}`],
        examples: [...pick(protein, 2, o + 3), ...pick(VEG, 1, o + 1), ...pick(carb, 2, o + 2)],
      };
    case "dinner":
      return {
        groups: ["ירקות", "מקור חלבון", `פחמימה ${kind === "gain" ? "כחלק מהארוחה" : "לפי הרעב והארוחות הקודמות"}`],
        examples: [...pick(protein, 2, o + 5), ...pick(VEG, 1, o + 2), ...pick(fat, 1, o + 1), ...pick(carb, 1, o + 4)],
      };
    case "snack":
      return {
        groups: ["רק אם מתאים: פרי, אגוזים, יוגורט או כריך קטן"],
        examples: [...pick(FRUIT, 1, o), ...pick(protein.filter((p) => !p.includes("עוף") && !p.includes("דג")), 1, o), ...pick(fat, 1, o + 2)],
      };
  }
}
