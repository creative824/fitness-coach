/**
 * The day's small tasks, all about food, movement and health, worked out from the person: a
 * 15-minute walk for a beginner who wants to lose weight, brisk walking for someone already
 * active, a cool-down on a workout day, protein at breakfast for someone building muscle.
 * Pure, so the server and the tests share it.
 *
 * Movement minutes follow the activity level, step up a little each week since the person
 * started (about 5 minutes a week, to a cap), and stay gentle when the health answers ask for it.
 * The food tasks rotate from day to day. Each task says why it was chosen, in one line.
 */
import type { GoalType } from "@/lib/onboarding/schema";

export interface SmartTaskInput {
  goals: GoalType[];
  experience: "beginner" | "intermediate" | "advanced" | null;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  age: number | null;
  bmi: number | null;
  weightKg: number | null;
  sleepHours: number | null;
  /** Health answers: gentle movement only, or nothing until a doctor approves. */
  lowIntensityOnly: boolean;
  needsDoctor: boolean;
  hideNumbers: boolean;
  workoutToday: boolean;
  /** Whole weeks since the person started, for the gradual step-up. */
  weeksIn: number;
  /** The day (YYYY-MM-DD): tasks rotate from day to day. */
  date?: string;
  /** Task ids given yesterday, avoided today when there are other choices. */
  recent?: string[];
  /** Grams of protein a day, for the half-way task. */
  proteinTarget?: number | null;
}

export type SmartTaskKind =
  | "walk"
  | "brisk_walk"
  | "jog"
  | "stretch"
  | "steps_break"
  | "aerobic"
  | "legs"
  | "cooldown"
  | "protein_breakfast"
  | "protein_lunch"
  | "protein_half"
  | "veg"
  | "fruit"
  | "swap_drink"
  | "fiber"
  | "real_meal";

/** Tasks that count for the fitness part of the daily score; the rest are daily tasks. */
export const MOVE_TASKS: SmartTaskKind[] = ["walk", "brisk_walk", "jog", "stretch", "steps_break", "aerobic", "legs", "cooldown"];

export interface SmartTask {
  /** Stable for the day, stored when done ("t:<id>"). */
  id: string;
  kind: SmartTaskKind;
  title: string;
  /** Why this task, for this person. */
  why: string;
  /** Minutes for movement tasks: activities the user adds count towards them. */
  minutes?: number;
  /** Grams of protein for the protein task. */
  grams?: number;
}

const BASE_MINUTES: Record<NonNullable<SmartTaskInput["activityLevel"]>, number> = {
  sedentary: 15,
  light: 20,
  moderate: 25,
  active: 30,
  very_active: 40,
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Minutes of walking for today. */
export function walkMinutes(i: SmartTaskInput): number {
  let m = BASE_MINUTES[i.activityLevel ?? "light"];
  if (i.experience === "beginner" || !i.experience) m = Math.min(m, 20);
  // About 5 more minutes a week, up to 25 minutes above the start.
  m += Math.min(25, i.weeksIn * 5);
  let cap = 45;
  if ((i.age ?? 0) >= 65) cap = 30;
  if ((i.bmi ?? 0) >= 35) cap = Math.min(cap, 35);
  if (i.lowIntensityOnly) cap = Math.min(cap, 20);
  m = Math.min(m, cap);
  // On a workout day the walk is shorter: the workout already moves the body.
  if (i.workoutToday) m = Math.min(m, 15);
  return round5(m);
}

/** A stable pseudo-random order for the day, so tasks change daily but not on every reload. */
function hash(str: string): number {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619);
  return h >>> 0;
}
function pick<T extends { id: string }>(pool: T[], n: number, seed: string, recent: string[]): T[] {
  const order = [...pool].sort((x, y) => hash(seed + x.id) - hash(seed + y.id));
  const fresh = order.filter((t) => !recent.includes(t.id));
  return [...fresh, ...order.filter((t) => recent.includes(t.id))].slice(0, n);
}

/**
 * The day's tasks: one or two for movement and two for food, all about nutrition, fitness and
 * health. They follow the goal and the activity level, change from day to day (avoiding
 * yesterday's), and never repeat what the workout or the protein target already cover.
 */
export function smartTasks(i: SmartTaskInput): SmartTask[] {
  const has = (g: GoalType) => i.goals.includes(g);
  const beginner = i.experience === "beginner" || !i.experience;
  const seed = i.date ?? "";
  const recent = i.recent ?? [];
  const move: SmartTask[] = [];

  // ── Movement ───────────────────────────────────────────────
  if (!i.needsDoctor) {
    const min = walkMinutes(i);
    const step = i.weeksIn > 0 && min > BASE_MINUTES[i.activityLevel ?? "light"] ? " עלינו קצת מהשבוע הקודם." : "";
    if (has("endurance") && !beginner && !i.lowIntensityOnly && !i.workoutToday) {
      const m = round5(Math.max(20, min));
      move.push({ id: "jog", kind: "jog", minutes: m, title: `ריצה קלה או הליכה מהירה ${m} דקות`, why: "המטרה שלך היא סיבולת: דקות רצופות בקצב שאפשר לדבר בו בונות אותה." + step });
    } else if (has("flexibility") && !has("lose_weight")) {
      move.push({ id: "stretch", kind: "stretch", minutes: 10, title: "מתיחות 10 דקות", why: "המטרה שלך היא גמישות: מתיחות קצרות כל יום עדיפות על ארוכות פעם בשבוע." });
    } else {
      const brisk = (has("lose_weight") || has("maintain_weight")) && !beginner && !i.lowIntensityOnly && (i.bmi ?? 0) < 35;
      move.push({
        id: brisk ? "brisk_walk" : "walk",
        kind: brisk ? "brisk_walk" : "walk",
        minutes: min,
        title: `${brisk ? "הליכה מהירה" : "הליכה"} ${min} דקות`,
        why: i.workoutToday
          ? "יש היום אימון, אז מספיקה הליכה קצרה. כל תנועה נוספת עוזרת."
          : beginner || i.activityLevel === "sedentary"
            ? `מתחילים בקטן כדי שזה יחזיק: ${min} דקות ביום, ומעלים בהדרגה.` + step
            : "הליכה היא הדרך הפשוטה להוסיף תנועה בלי עומס על הגוף." + step,
      });
    }
    // A second, different kind of movement: cool-down after a workout, otherwise legs or cardio.
    if (i.workoutToday) {
      move.push({ id: "cooldown", kind: "cooldown", title: "5 דקות מתיחות אחרי האימון", why: "מתיחה קלה אחרי אימון מורידה את הדופק בהדרגה ועוזרת לגוף להתאושש." });
    } else if (!i.lowIntensityOnly) {
      const extras: SmartTask[] = [
        { id: "legs", kind: "legs", title: "3 סטים של סקוואט (10 חזרות)", why: "ביום בלי אימון, כמה סטים של רגליים שומרים על השרירים הגדולים פעילים." },
        { id: "aerobic", kind: "aerobic", minutes: 10, title: "10 דקות פעילות אירובית", why: "עשר דקות של דופק מוגבר (אופניים, מדרגות, ריקוד) משפרות את הכושר." },
      ];
      if (i.activityLevel === "sedentary") extras.push({ id: "breaks", kind: "steps_break", title: "לקום ולזוז 3 דקות כל שעה", why: "ישיבה ארוכה פוגעת גם כשמתאמנים. הפסקות קצרות מפזרות תנועה לאורך היום." });
      if (has("flexibility") && move[0].kind !== "stretch") extras.push({ id: "stretch", kind: "stretch", minutes: 10, title: "מתיחות 10 דקות", why: "ביקשת לשפר גמישות." });
      const usable = beginner ? extras.filter((t) => t.kind !== "legs") : extras;
      move.push(...pick(usable, 1, seed, recent));
    }
  }

  // ── Food ───────────────────────────────────────────────────
  const building = has("muscle") || has("strength") || has("gain_weight");
  const losing = has("lose_weight");
  const half = i.proteinTarget && !i.hideNumbers ? Math.round(i.proteinTarget / 2 / 5) * 5 : null;
  const food: SmartTask[] = [
    { id: "protein_breakfast", kind: "protein_breakfast", title: "מקור חלבון בארוחת הבוקר", why: "ביצים, יוגורט או גבינה בבוקר משביעים לאורך זמן ומקדמים את יעד החלבון." },
    { id: "protein_lunch", kind: "protein_lunch", title: "מקור חלבון בארוחת הצהריים", why: "עוף, דג, טופו או קטניות בצהריים: חלבון שמחולק לאורך היום מנוצל טוב יותר." },
    { id: "veg", kind: "veg", title: "מנת ירקות לצד ארוחה", why: "ירקות ממלאים בפחות קלוריות ומוסיפים סיבים וויטמינים." },
    { id: "fruit", kind: "fruit", title: "פרי אחד במהלך היום", why: "פרי הוא נשנוש מתוק עם סיבים, במקום חטיף." },
    { id: "fiber", kind: "fiber", title: "מקור סיבים בארוחה (קטניות או דגן מלא)", why: "סיבים מאטים את הספיגה ומשביעים יותר." },
  ];
  if (half) food.push({ id: "protein_half", kind: "protein_half", grams: half, title: `${half} גרם חלבון עד הצהריים`, why: "חצי מיעד החלבון עד הצהריים משאיר ערב רגוע, בלי לרדוף אחרי היעד." });
  if (losing || !building) {
    food.push({ id: "swap_drink", kind: "swap_drink", title: "להחליף משקה ממותק במים", why: "משקאות ממותקים הם קלוריות שלא משביעות. מים או סודה בלי סוכר במקומם." });
    food.push({ id: "real_meal", kind: "real_meal", title: "ארוחה מסודרת במקום נשנושים", why: "ארוחה ישובה עם חלבון וירקות משביעה יותר מכמה נשנושים קטנים." });
  }
  // Protein first for those who build muscle; the rest rotate.
  const lead = building ? food.filter((t) => t.kind === "protein_breakfast" || t.kind === "protein_half" || t.kind === "protein_lunch") : [];
  const firstFood = lead.length ? pick(lead, 1, seed, recent) : [];
  const restFood = pick(
    food.filter((t) => !firstFood.includes(t)),
    2 - firstFood.length,
    seed + ":food",
    recent,
  );

  return [...move, ...firstFood, ...restFood];
}

/** Minutes of today's added activities that count towards a movement task. */
export function minutesFor(kind: SmartTaskKind, acts: { kind: string; min: number }[]): number {
  const counts: Record<string, string[]> = {
    walk: ["walk", "brisk_walk", "run", "bike", "swim", "stairs", "dance", "ball", "gym"],
    brisk_walk: ["brisk_walk", "run", "bike", "swim", "stairs", "dance", "ball"],
    jog: ["run", "brisk_walk", "bike", "swim"],
    stretch: ["yoga"],
    aerobic: ["brisk_walk", "run", "bike", "swim", "stairs", "dance", "ball"],
  };
  const kinds = counts[kind];
  return kinds ? acts.filter((a) => kinds.includes(a.kind)).reduce((s, a) => s + a.min, 0) : 0;
}
