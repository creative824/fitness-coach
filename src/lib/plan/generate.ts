/**
 * Step 5 of the plan engine: arrange the filtered candidates into a week.
 *
 * This is the rule-based composer. It is deterministic (same input, same week) and it can
 * only use ids it was given, so it never invents an exercise or a meal. An AI composer can
 * replace it later behind the same input and output; the validator (validate.ts) checks either.
 */
import type { GoalType } from "@/lib/onboarding/schema";
import type { SafetyResult } from "@/lib/safety/screen";
import type { ExerciseCandidate, MealCandidate } from "./candidates";
import { maxDifficulty } from "./candidates";
import type { PlanDay, WeeklyPlan } from "./schema";
import { fitBlocks, toMinutes, totalSeconds, warmupSeconds } from "./duration";
import type { Targets } from "./targets";
import { weekDates } from "./week";

export const COMPOSER_ID = "rules-v1";

export interface ComposeInput {
  weekStart: string;
  goals: GoalType[];
  safety: SafetyResult;
  targets: Targets;
  experience: "beginner" | "intermediate" | "advanced" | null;
  location: string[];
  availableDays: number[];
  busyDays: number[];
  sessionMinutes: number | null;
  mealsPerDay: number | null;
  allergies: string[];
  exercises: ExerciseCandidate[];
  meals: MealCandidate[];
}

type Slot = "breakfast" | "lunch" | "dinner" | "snack";

export function mealSlots(mealsPerDay: number | null): Slot[] {
  const n = Math.min(6, Math.max(1, mealsPerDay ?? 3));
  if (n === 1) return ["lunch"];
  if (n === 2) return ["breakfast", "dinner"];
  return [...(["breakfast", "lunch", "dinner"] as Slot[]), ...Array.from({ length: n - 3 }, () => "snack" as Slot)];
}

/** Spread `count` workouts over the available days, preferring days that are not busy. */
export function pickWorkoutDays(count: number, availableDays: number[], busyDays: number[]): number[] {
  if (count <= 0) return [];
  const pool = (availableDays.length ? [...availableDays] : [0, 2, 4]).sort((a, b) => a - b);
  const free = pool.filter((d) => !busyDays.includes(d));
  const source = free.length >= count ? free : pool;
  if (source.length <= count) return source.slice(0, count);
  // Even spacing through the sorted list keeps rest days between workouts where possible.
  const step = source.length / count;
  return Array.from({ length: count }, (_, i) => source[Math.floor(i * step)]);
}

/** Movement patterns of a full-body session, in the order they are filled. */
const PATTERNS = {
  lower: (e: ExerciseCandidate) =>
    e.category === "strength" && e.primary_muscles.some((m) => ["quads", "glutes", "hamstrings"].includes(m)),
  push: (e: ExerciseCandidate) =>
    e.category === "strength" && e.primary_muscles.some((m) => ["chest", "shoulders", "triceps"].includes(m)),
  pull: (e: ExerciseCandidate) =>
    e.category === "strength" && e.primary_muscles.some((m) => ["upper_back", "biceps"].includes(m)),
  core: (e: ExerciseCandidate) => e.category === "core",
  cardio: (e: ExerciseCandidate) => e.category === "cardio",
  mobility: (e: ExerciseCandidate) => e.category === "mobility",
} as const;
type Pattern = keyof typeof PATTERNS;

const PATTERN_HE: Record<Pattern, string> = {
  lower: "רגליים וישבן",
  push: "דחיפה (חזה וכתפיים)",
  pull: "משיכה (גב)",
  core: "בטן וליבה",
  cardio: "סיבולת",
  mobility: "תנועתיות",
};

export function sessionPatterns(minutes: number | null): Pattern[] {
  const m = minutes ?? 30;
  if (m <= 20) return ["lower", "push", "core"];
  if (m <= 35) return ["lower", "push", "pull", "core"];
  if (m <= 50) return ["lower", "push", "pull", "core", "cardio"];
  return ["lower", "push", "pull", "lower", "core", "mobility"];
}

const DOSE = {
  beginner: { sets: 2, reps: 10, seconds: 20, rest: 60 },
  intermediate: { sets: 3, reps: 12, seconds: 30, rest: 75 },
  advanced: { sets: 4, reps: 10, seconds: 40, rest: 90 },
} as const;

const LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז"];

function buildWorkout(index: number, input: ComposeInput): PlanDay["workout"] {
  const level = maxDifficulty({ experience: input.experience, safety: input.safety });
  const dose = DOSE[level];
  const low = input.safety.restrictions.lowIntensityOnly;
  const used = new Set<string>();
  const blocks: NonNullable<PlanDay["workout"]>["blocks"] = [];
  const trained: Pattern[] = [];

  for (const [slotIndex, pattern] of sessionPatterns(input.sessionMinutes).entries()) {
    const options = input.exercises.filter((e) => PATTERNS[pattern](e) && !used.has(e.id));
    if (!options.length) continue;
    // Rotate through the options so each workout of the week differs.
    const pick = options[(index + slotIndex) % options.length];
    used.add(pick.id);
    trained.push(pattern);
    const sets = low ? Math.min(2, dose.sets) : dose.sets;
    const rest = low ? 90 : dose.rest;
    blocks.push(
      pick.mode === "seconds"
        ? { exercise_id: pick.id, sets, seconds: dose.seconds, rest_seconds: rest }
        : { exercise_id: pick.id, sets, reps: dose.reps, rest_seconds: rest },
    );
  }
  if (!blocks.length) return null;

  // The user's time is a hard limit (follow-up spec §4). The full workout is trimmed to fit;
  // the full one is kept aside and shown only if the user asks for it.
  const budget = input.sessionMinutes ?? 30;
  const slugOf = (id: string) => input.exercises.find((e) => e.id === id)?.slug;
  const fitted = fitBlocks(blocks, budget, slugOf);
  if (!fitted) return null;
  const warmup = warmupSeconds(budget);
  const minutes = toMinutes(totalSeconds(fitted, warmup, slugOf));
  const fullMinutes = toMinutes(totalSeconds(blocks, warmupSeconds(Math.max(budget, 31)), slugOf));
  const keptPatterns = trained.slice(0, fitted.length);

  const location = input.location.includes("gym") ? "gym" : input.location.includes("home") || !input.location.length ? "home" : "outdoors";
  const names = [...new Set(keptPatterns)].map((p) => PATTERN_HE[p]);
  return {
    title: `אימון כל הגוף ${LETTERS[index] ?? index + 1}`,
    location,
    estimated_minutes: minutes,
    difficulty: level,
    blocks: fitted,
    why: `מאמן ${names.join(", ")}.${low ? " בעצימות נמוכה, לפי מה שסימנת בשאלון." : ""}`.slice(0, 280),
    warmup_minutes: toMinutes(warmup),
    budget_minutes: budget,
    ...(fullMinutes > budget ? { full: { estimated_minutes: Math.min(120, fullMinutes), blocks } } : {}),
  };
}

function pickMeals(dayIndex: number, slots: Slot[], meals: MealCandidate[]): PlanDay["meals"] {
  const out: PlanDay["meals"] = [];
  const usedToday = new Set<string>();
  let snackNo = 0;
  for (const slot of slots) {
    const options = meals.filter((m) => m.meal_type.includes(slot) && !usedToday.has(m.id));
    if (!options.length) continue;
    const offset = slot === "snack" ? snackNo++ * 2 : 0;
    // Different idea each day for the same slot; a stride of 3 also mixes the order.
    const pick = options[(dayIndex * 3 + offset) % options.length];
    usedToday.add(pick.id);
    const alternatives = options.filter((m) => m.id !== pick.id).slice(0, 3).map((m) => m.id);
    out.push({ slot, meal_idea_id: pick.id, portion: pick.portion, alternatives });
  }
  return out;
}

const FOCUS: Partial<Record<GoalType, string>> = {
  lose_weight: "ירידה הדרגתית במשקל, בקצב שאפשר להחזיק",
  maintain_weight: "שמירה על המשקל והרגלים יציבים",
  gain_weight: "עלייה הדרגתית במשקל",
  strength: "בניית כוח בסיסי",
  muscle: "בניית שריר",
  endurance: "שיפור הסיבולת",
  general_fitness: "כושר כללי ותנועה קבועה",
  flexibility: "גמישות ותנועתיות",
  habits: "הרגלים קטנים שמחזיקים לאורך זמן",
};

export function composeWeek(input: ComposeInput): WeeklyPlan {
  const { safety, targets } = input;
  const dates = weekDates(input.weekStart);
  const workoutDays = pickWorkoutDays(targets.workouts_per_week, input.availableDays, input.busyDays);
  const slots = mealSlots(input.mealsPerDay);
  const refer = safety.level === "refer";
  let workoutIndex = 0;

  const days: PlanDay[] = dates.map((date, i) => {
    const workout = workoutDays.includes(i) ? buildWorkout(workoutIndex++, input) : null;
    const habits: PlanDay["habits"] = [];
    if (targets.water_ml) {
      habits.push({ type: "water", title: "לשתות לאורך היום", target: `${(targets.water_ml / 1000).toFixed(1)} ליטר` });
    }
    if (!workout) {
      habits.push(
        refer
          ? { type: "movement", title: "הליכה קלה", target: "רק אחרי אישור רופא" }
          : { type: "movement", title: "הליכה או תנועה קלה", target: "20 דקות" },
      );
    }
    habits.push({ type: "recovery", title: "שינה מספקת", target: "7–9 שעות" });
    return { date, is_rest_day: !workout, meals: pickMeals(i, slots, input.meals), workout, habits };
  });

  const actualWorkouts = days.filter((d) => d.workout).length;
  const principles = [
    "ארוחות פשוטות, בלי ספירת קלוריות",
    "שתייה לאורך כל היום, לא הכול בבת אחת",
    actualWorkouts ? "מנוחה בין ימי אימון" : "תנועה קלה כל יום",
  ];
  const assumptions = [
    actualWorkouts ? `${actualWorkouts} אימונים בשבוע, לפי הימים הפנויים שסימנת` : "בלי אימונים השבוע",
    input.allergies.length ? "בלי האלרגנים שסימנת" : "לא סומנו אלרגיות",
  ];
  if (safety.level !== "clear") assumptions.push("התוכנית זהירה בגלל תשובות בשאלון הבריאות");

  const explanation = [
    "בחרנו רק תרגילים ורעיונות לארוחות שאושרו במאגר ומתאימים לציוד, לניסיון ולהעדפות שלך.",
    actualWorkouts
      ? "האימונים מכסים את כל הגוף ומתחלפים במהלך השבוע, כדי שכל קבוצת שרירים תקבל זמן להתאושש."
      : "השבוע מתמקד בהרגלים ובתנועה קלה.",
    refer ? "לפני שמתחילים להתאמן חשוב לקבל אישור מרופא." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    schema_version: 1,
    week_start: input.weekStart,
    summary: {
      focus: (refer ? "הרגלים בריאים ומנוחה, עד אישור רופא" : FOCUS[input.goals[0]] ?? FOCUS.general_fitness)!,
      principles,
      assumptions,
    },
    targets: { ...targets, workouts_per_week: actualWorkouts },
    days,
    explanation,
  };
}
