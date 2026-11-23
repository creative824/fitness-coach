/**
 * The day's small tasks, worked out from the person rather than fixed numbers: a 15-minute walk
 * for a beginner who wants to lose weight, 35 minutes of brisk walking for someone already
 * active, stretching for flexibility, a protein target for muscle, an earlier night for someone
 * who sleeps 6 hours. Pure, so the server and the tests share it.
 *
 * Movement minutes follow the activity level, step up a little each week since the person
 * started (about 5 minutes a week, to a cap), and stay gentle when the health answers ask for it.
 * Each task says why it was chosen, in one line.
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
}

export type SmartTaskKind = "walk" | "brisk_walk" | "jog" | "stretch" | "protein" | "sleep" | "log_food" | "veg" | "steps_break";

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

export function smartTasks(i: SmartTaskInput): SmartTask[] {
  const tasks: SmartTask[] = [];
  const goal = i.goals[0] ?? "general_fitness";
  const has = (g: GoalType) => i.goals.includes(g);
  const beginner = i.experience === "beginner" || !i.experience;

  // ── Movement ───────────────────────────────────────────────
  if (!i.needsDoctor) {
    const min = walkMinutes(i);
    const step = i.weeksIn > 0 && min > BASE_MINUTES[i.activityLevel ?? "light"] ? " עלינו קצת מהשבוע הקודם." : "";
    if (has("endurance") && !beginner && !i.lowIntensityOnly && !i.workoutToday) {
      tasks.push({ id: "jog", kind: "jog", minutes: round5(Math.max(20, min)), title: `ריצה קלה או הליכה מהירה ${round5(Math.max(20, min))} דקות`, why: "המטרה שלך היא סיבולת: דקות רצופות בקצב שאפשר לדבר בו בונות אותה." + step });
    } else if (has("lose_weight") || has("maintain_weight")) {
      const brisk = !beginner && !i.lowIntensityOnly && (i.bmi ?? 0) < 35;
      tasks.push({
        id: brisk ? "brisk_walk" : "walk",
        kind: brisk ? "brisk_walk" : "walk",
        minutes: min,
        title: `${brisk ? "הליכה מהירה" : "הליכה"} ${min} דקות`,
        why: i.workoutToday
          ? "יש היום אימון, אז מספיקה הליכה קצרה. כל תנועה נוספת מגדילה את הגירעון."
          : beginner || i.activityLevel === "sedentary"
            ? `מתחילים בקטן כדי שזה יחזיק: ${min} דקות ביום הן הצעד הראשון, ומעלים בהדרגה.` + step
            : "הליכה היא הדרך הפשוטה להוסיף גירעון קלורי בלי עומס על הגוף." + step,
      });
    } else if (has("flexibility")) {
      tasks.push({ id: "stretch", kind: "stretch", minutes: 10, title: "מתיחות 10 דקות", why: "המטרה שלך היא גמישות: מתיחות קצרות כל יום עדיפות על ארוכות פעם בשבוע." });
    } else if (!i.workoutToday || beginner) {
      tasks.push({
        id: "walk",
        kind: "walk",
        minutes: min,
        title: `הליכה ${min} דקות`,
        why: i.activityLevel === "sedentary" ? "רוב היום בישיבה: הליכה קצרה כל יום היא השינוי הכי משמעותי שאפשר לעשות." : "תנועה יומית קלה משפרת התאוששות וכושר כללי." + step,
      });
    }
  }
  // Second choices, used only when there is room after food and sleep.
  const extras: SmartTask[] = [];
  if (!i.needsDoctor && i.activityLevel === "sedentary") {
    // Sitting most of the day: short breaks matter as much as one walk.
    extras.push({ id: "breaks", kind: "steps_break", title: "לקום ולזוז 3 דקות כל שעה", why: "ישיבה ארוכה פוגעת גם כשמתאמנים. הפסקות קצרות מפזרות תנועה לאורך היום." });
  }
  if (!i.needsDoctor && has("flexibility") && tasks[0]?.kind !== "stretch") {
    extras.unshift({ id: "stretch", kind: "stretch", minutes: 10, title: "מתיחות 10 דקות", why: "ביקשת לשפר גמישות." });
  }

  // ── Food ───────────────────────────────────────────────────
  if ((has("muscle") || has("strength") || has("gain_weight")) && i.weightKg && !i.hideNumbers) {
    const g = Math.round((i.weightKg * (has("muscle") ? 1.6 : 1.4)) / 5) * 5;
    tasks.push({ id: "protein", kind: "protein", grams: g, title: `חלבון: כ-${g} גרם היום`, why: `לבניית שריר צריך בערך ${has("muscle") ? "1.6" : "1.4"} גרם חלבון לכל ק״ג משקל גוף.` });
  } else if ((goal === "lose_weight" || has("lose_weight")) && !i.hideNumbers) {
    tasks.push({ id: "log", kind: "log_food", title: "לרשום את כל מה שאכלת היום", why: "מי שרושם מה הוא אוכל יורד במשקל יותר. גם נשנוש קטן נחשב." });
  } else {
    tasks.push({ id: "veg", kind: "veg", title: "ירקות בשתי ארוחות", why: "ירקות ממלאים בפחות קלוריות ומוסיפים סיבים." });
  }

  // ── Sleep ──────────────────────────────────────────────────
  if (i.sleepHours !== null && i.sleepHours < 7) {
    tasks.push({ id: "sleep", kind: "sleep", title: "ללכת לישון 30 דקות מוקדם יותר", why: `סימנת שינה של כ-${i.sleepHours} שעות בלילה. שינה קצרה מגבירה רעב ומקשה על ההתאוששות.` });
  }

  return [...tasks, ...extras].slice(0, 3);
}

/** Minutes of today's added activities that count towards a movement task. */
export function minutesFor(kind: SmartTaskKind, acts: { kind: string; min: number }[]): number {
  const counts: Record<string, string[]> = {
    walk: ["walk", "brisk_walk", "run", "bike", "swim", "stairs", "dance", "ball", "gym"],
    brisk_walk: ["brisk_walk", "run", "bike", "swim", "stairs", "dance", "ball"],
    jog: ["run", "brisk_walk", "bike", "swim"],
    stretch: ["yoga"],
  };
  const kinds = counts[kind];
  return kinds ? acts.filter((a) => kinds.includes(a.kind)).reduce((s, a) => s + a.min, 0) : 0;
}
