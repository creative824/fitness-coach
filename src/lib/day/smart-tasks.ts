/**
 * The day's small tasks, all about food, movement and health, worked out from the person and
 * from what they did: a 15-minute walk for a beginner who wants to lose weight, brisk walking
 * for someone already active, a cool-down on a workout day, protein at breakfast when protein
 * fell short yesterday, a sweet drink swapped for water when calories ran over. Pure, so the
 * server and the tests share it.
 *
 * - The pool of possible tasks is scored for relevance (goal, yesterday's calories and protein,
 *   today's workout) and for history: tasks given in the last two days step back, tasks ignored
 *   again and again rotate out, a habit already formed makes room for a new one.
 * - Never more than four, never two that say the same thing (a walk and a jog, two protein
 *   tasks unless protein is the day's issue), nothing the day already shows as done.
 * - Movement minutes follow the activity level, step up about 5 minutes a week since the person
 *   started (to a cap), and stay gentle when the health answers ask for it.
 * Each task says why it was chosen, in one line.
 */
import type { GoalType } from "@/lib/onboarding/schema";

export interface TaskDay {
  /** Task ids given that day. */
  given: string[];
  /** Task ids done that day. */
  done: string[];
}

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
  /** Muscle groups in today's workout ("legs", "push"…), so no task repeats them. */
  workoutGroups?: string[];
  /** Whole weeks since the person started, for the gradual step-up. */
  weeksIn: number;
  /** The day (YYYY-MM-DD): tasks rotate from day to day. */
  date?: string;
  /** Task ids given yesterday (older callers); `history` is preferred. */
  recent?: string[];
  /** The tasks of the last days, the most recent first. */
  history?: TaskDay[];
  /** Grams of protein a day, for the half-way task. */
  proteinTarget?: number | null;
  /** How yesterday went: calories and protein eaten against their targets. */
  yesterday?: { kcal: number | null; kcalTarget: number | null; protein: number | null } | null;
  /** Kinds the day already shows as done (e.g. a 20-minute walk logged): not offered. */
  satisfied?: SmartTaskKind[];
}

export type SmartTaskKind =
  | "walk"
  | "brisk_walk"
  | "jog"
  | "stretch"
  | "steps_break"
  | "aerobic"
  | "legs"
  | "pushups"
  | "cooldown"
  | "protein_breakfast"
  | "protein_lunch"
  | "protein_half"
  | "veg"
  | "fruit"
  | "swap_drink"
  | "fiber"
  | "real_meal"
  | "light_dinner"
  | "energy_snack";

/** Tasks that count for the fitness part of the daily score; the rest are daily tasks. */
export const MOVE_TASKS: SmartTaskKind[] = ["walk", "brisk_walk", "jog", "stretch", "steps_break", "aerobic", "legs", "pushups", "cooldown"];

const PROTEIN_TASKS: SmartTaskKind[] = ["protein_breakfast", "protein_lunch", "protein_half"];

export const MAX_TASKS = 4;

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

/** A stable pseudo-random number for the day, so tasks change daily but not on every reload. */
function hash(str: string): number {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619);
  return h >>> 0;
}

interface Candidate extends SmartTask {
  /** How much the task fits today; higher first. */
  score: number;
  /** "main" movement (one at most), "extra" movement, or food. */
  slot: "main" | "extra" | "food";
}

/** How yesterday's food went, in words the rules use. */
function yesterdayOf(i: SmartTaskInput) {
  const y = i.yesterday;
  const over = Boolean(y?.kcal && y.kcalTarget && y.kcal > y.kcalTarget * 1.1);
  const under = Boolean(y?.kcal && y.kcalTarget && y.kcal < y.kcalTarget * 0.8);
  const lowProtein = Boolean(y?.protein !== null && y?.protein !== undefined && i.proteinTarget && y.kcal && y.protein < i.proteinTarget * 0.8);
  return { over, under, lowProtein };
}

/** Every task that could fit this person today, with a relevance score. */
export function taskPool(i: SmartTaskInput): Candidate[] {
  const has = (g: GoalType) => i.goals.includes(g);
  const beginner = i.experience === "beginner" || !i.experience;
  const building = has("muscle") || has("strength") || has("gain_weight");
  const losing = has("lose_weight");
  const y = yesterdayOf(i);
  const groups = new Set(i.workoutGroups ?? []);
  const out: Candidate[] = [];

  // ── Movement ───────────────────────────────────────────────
  if (!i.needsDoctor) {
    const min = walkMinutes(i);
    const step = i.weeksIn > 0 && min > BASE_MINUTES[i.activityLevel ?? "light"] ? " עלינו קצת מהשבוע הקודם." : "";
    if (has("endurance") && !beginner && !i.lowIntensityOnly && !i.workoutToday) {
      const m = round5(Math.max(20, min));
      out.push({ slot: "main", score: 5, id: "jog", kind: "jog", minutes: m, title: `ריצה קלה או הליכה מהירה ${m} דקות`, why: "המטרה שלך היא סיבולת: דקות רצופות בקצב שאפשר לדבר בו בונות אותה." + step });
    } else if (has("flexibility") && !losing) {
      out.push({ slot: "main", score: 5, id: "stretch", kind: "stretch", minutes: 10, title: "מתיחות 10 דקות", why: "המטרה שלך היא גמישות: מתיחות קצרות כל יום עדיפות על ארוכות פעם בשבוע." });
    } else {
      const brisk = (losing || has("maintain_weight")) && !beginner && !i.lowIntensityOnly && (i.bmi ?? 0) < 35;
      out.push({
        slot: "main",
        score: 5,
        id: brisk ? "brisk_walk" : "walk",
        kind: brisk ? "brisk_walk" : "walk",
        minutes: min,
        title: `${brisk ? "הליכה מהירה" : "הליכה"} ${min} דקות`,
        why: i.workoutToday
          ? "יש היום אימון, אז מספיקה הליכה קצרה. כל תנועה נוספת עוזרת."
          : y.over && losing
            ? "אתמול עברת קצת את יעד הקלוריות. הליכה היום מאזנת בלי לרעוב."
            : beginner || i.activityLevel === "sedentary"
              ? `מתחילים בקטן כדי שזה יחזיק: ${min} דקות ביום, ומעלים בהדרגה.` + step
              : "הליכה היא הדרך הפשוטה להוסיף תנועה בלי עומס על הגוף." + step,
      });
    }
    // A second, different kind of movement: cool-down after a workout, otherwise strength or cardio.
    if (i.workoutToday) {
      out.push({ slot: "extra", score: 3, id: "cooldown", kind: "cooldown", title: "5 דקות מתיחות אחרי האימון", why: "מתיחה קלה אחרי אימון מורידה את הדופק בהדרגה ועוזרת לגוף להתאושש." });
    } else if (!i.lowIntensityOnly) {
      out.push({ slot: "extra", score: 2 + (has("endurance") || losing ? 1 : 0), id: "aerobic", kind: "aerobic", minutes: 10, title: "10 דקות פעילות אירובית", why: "עשר דקות של דופק מוגבר (אופניים, מדרגות, ריקוד) משפרות את הכושר." });
      if (!beginner && !groups.has("legs"))
        out.push({ slot: "extra", score: 2 + (building ? 1 : 0), id: "legs", kind: "legs", title: "3 סטים של סקוואט (10 חזרות)", why: "ביום בלי אימון, כמה סטים של רגליים שומרים על השרירים הגדולים פעילים." });
      if (building && !groups.has("push"))
        out.push({ slot: "extra", score: 2 + (beginner ? 0 : 1), id: "pushups", kind: "pushups", title: beginner ? "2 סטים של שכיבות סמיכה על הברכיים" : "3 סטים של שכיבות סמיכה", why: "המטרה שלך היא כוח ושריר: כמה סטים קצרים ביום מנוחה שומרים על הרצף." });
      if (i.activityLevel === "sedentary")
        out.push({ slot: "extra", score: 3, id: "breaks", kind: "steps_break", title: "לקום ולזוז 3 דקות כל שעה", why: "ישיבה ארוכה פוגעת גם כשמתאמנים. הפסקות קצרות מפזרות תנועה לאורך היום." });
      if (has("flexibility") && !out.some((t) => t.kind === "stretch"))
        out.push({ slot: "extra", score: 3, id: "stretch", kind: "stretch", minutes: 10, title: "מתיחות 10 דקות", why: "ביקשת לשפר גמישות." });
    }
  }

  // ── Food ───────────────────────────────────────────────────
  const half = i.proteinTarget && !i.hideNumbers ? Math.round(i.proteinTarget / 2 / 5) * 5 : null;
  const proteinBoost = (building ? 2 : 0) + (y.lowProtein ? 3 : 0);
  const proteinWhy = y.lowProtein ? "אתמול החלבון נשאר מתחת ליעד. " : "";
  out.push(
    { slot: "food", score: 1 + proteinBoost, id: "protein_breakfast", kind: "protein_breakfast", title: "מקור חלבון בארוחת הבוקר", why: proteinWhy + "ביצים, יוגורט או גבינה בבוקר משביעים לאורך זמן ומקדמים את יעד החלבון." },
    { slot: "food", score: 1 + proteinBoost, id: "protein_lunch", kind: "protein_lunch", title: "מקור חלבון בארוחת הצהריים", why: proteinWhy + "עוף, דג, טופו או קטניות בצהריים: חלבון שמחולק לאורך היום מנוצל טוב יותר." },
    { slot: "food", score: 2 + (losing ? 1 : 0), id: "veg", kind: "veg", title: "מנת ירקות לצד ארוחה", why: "ירקות ממלאים בפחות קלוריות ומוסיפים סיבים וויטמינים." },
    { slot: "food", score: 1, id: "fruit", kind: "fruit", title: "פרי אחד במהלך היום", why: "פרי הוא נשנוש מתוק עם סיבים, במקום חטיף." },
    { slot: "food", score: 1 + (losing ? 1 : 0), id: "fiber", kind: "fiber", title: "מקור סיבים בארוחה (קטניות או דגן מלא)", why: "סיבים מאטים את הספיגה ומשביעים יותר." },
  );
  if (half) out.push({ slot: "food", score: 1 + proteinBoost, id: "protein_half", kind: "protein_half", grams: half, title: `${half} גרם חלבון עד הצהריים`, why: proteinWhy + "חצי מיעד החלבון עד הצהריים משאיר ערב רגוע, בלי לרדוף אחרי היעד." });
  if (losing || !building) {
    out.push({ slot: "food", score: 1 + (y.over ? 3 : 0) + (losing ? 1 : 0), id: "swap_drink", kind: "swap_drink", title: "להחליף משקה ממותק במים", why: (y.over ? "אתמול הקלוריות עברו את היעד. " : "") + "משקאות ממותקים הם קלוריות שלא משביעות. מים או סודה בלי סוכר במקומם." });
    out.push({ slot: "food", score: 1 + (y.under && losing ? 3 : 0), id: "real_meal", kind: "real_meal", title: "ארוחה מסודרת במקום נשנושים", why: (y.under && losing ? "אתמול אכלת הרבה פחות מהיעד, וזה נוטה להיגמר בנשנושים בערב. " : "") + "ארוחה ישובה עם חלבון וירקות משביעה יותר מכמה נשנושים קטנים." });
    if (y.over) out.push({ slot: "food", score: 3, id: "light_dinner", kind: "light_dinner", title: "ארוחת ערב קלה: חלבון וירקות", why: "אתמול עברת את יעד הקלוריות. ערב קל מחזיר את השבוע לאיזון." });
  }
  if (building && (has("gain_weight") || y.under))
    out.push({ slot: "food", score: 2 + (y.under ? 3 : 0), id: "energy_snack", kind: "energy_snack", title: "נשנוש משביע בין הארוחות (יוגורט וגרנולה, כריך, אגוזים)", why: (y.under ? "אתמול אכלת פחות מהיעד. " : "") + "כדי לבנות שריר צריך מספיק אנרגיה: נשנוש אחד נוסף עושה את ההבדל." });
  return out;
}

/** Fewer points for what was given lately, ignored again and again, or already a habit. */
function historyPenalty(id: string, i: SmartTaskInput): number {
  const days = i.history ?? (i.recent ? [{ given: i.recent, done: [] }] : []);
  let p = 0;
  if (days.slice(0, 2).some((d) => d.given.includes(id))) p += 3;
  const week = days.slice(0, 7);
  const given = week.filter((d) => d.given.includes(id)).length;
  const done = week.filter((d) => d.done.includes(id)).length;
  if (given >= 2 && done === 0) p += 2;
  if (done >= 3) p += 1;
  return p;
}

/**
 * The day's tasks: one or two for movement and two for food, four at most. They follow the
 * goal, yesterday's calories and protein and today's workout, change from day to day (avoiding
 * the last days' tasks), and leave out anything the day already shows as done.
 */
export function smartTasks(i: SmartTaskInput): SmartTask[] {
  const seed = i.date ?? "";
  const satisfied = new Set(i.satisfied ?? []);
  const y = yesterdayOf(i);
  const ranked = taskPool(i)
    .filter((t) => !satisfied.has(t.kind))
    .map((t) => ({ ...t, rank: t.score - historyPenalty(t.id, i) }))
    .sort((a, b) => b.rank - a.rank || hash(seed + a.id) - hash(seed + b.id));

  // Two movement tasks at most, one of them the main walk / run / stretch.
  const move: Candidate[] = [];
  for (const t of ranked.filter((x) => x.slot !== "food")) {
    if (move.length >= 2) break;
    if (t.slot === "main" && move.some((m) => m.slot === "main")) continue;
    move.push(t);
  }
  // Two protein tasks say the same thing, unless protein is the day's issue.
  const maxProtein = y.lowProtein ? 2 : 1;
  const food: Candidate[] = [];
  for (const t of ranked.filter((x) => x.slot === "food")) {
    if (food.length >= 2) break;
    if (PROTEIN_TASKS.includes(t.kind) && food.filter((f) => PROTEIN_TASKS.includes(f.kind)).length >= maxProtein) continue;
    if (t.kind === "light_dinner" && food.some((f) => f.kind === "real_meal")) continue;
    if (t.kind === "real_meal" && food.some((f) => f.kind === "light_dinner")) continue;
    food.push(t);
  }
  return [...move, ...food].slice(0, MAX_TASKS).map(({ id, kind, title, why, minutes, grams }) => ({
    id,
    kind,
    title,
    why,
    ...(minutes ? { minutes } : {}),
    ...(grams ? { grams } : {}),
  }));
}

/** The tasks given earlier today, by id, so the list stays the same all day. */
export function tasksByIds(i: SmartTaskInput, ids: string[]): SmartTask[] {
  const pool = new Map(taskPool(i).map((t) => [t.id, t]));
  return ids.flatMap((id) => {
    const t = pool.get(id);
    if (!t) return [];
    return [{ id, kind: t.kind, title: t.title, why: t.why, ...(t.minutes ? { minutes: t.minutes } : {}), ...(t.grams ? { grams: t.grams } : {}) }];
  });
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
