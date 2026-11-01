/**
 * Weekly targets (spec §7 step 3), computed in code and never by the model.
 *
 * Calories: a daily target built from the Mifflin-St Jeor equation, the activity level and a
 * moderate adjustment for the goal (see calorieTarget). It is shown as a target with a small
 * range around it, always labelled as an estimate. Sex is optional in the questionnaire;
 * without it the range spans both equations and is wider.
 * No target is given when the safety screen says so, or when the data is missing.
 */
import type { GoalType } from "@/lib/onboarding/schema";
import type { SafetyResult } from "@/lib/safety/screen";
import { dailyWaterTargetMl } from "@/lib/water/plan";

export const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Lower bound so the target never suggests very low intake. */
const MIN_CALORIES = 1400;
/** kcal per kg of body-weight change, the usual rule of thumb (Hall 2008: about 7,700). */
export const KCAL_PER_KG = 7700;

export type Sex = "male" | "female";

export interface TargetInput {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Optional. Without it the range spans both Mifflin-St Jeor equations and is wider. */
  sex?: Sex | null;
  activityLevel: string | null;
  goals: GoalType[];
  experience: "beginner" | "intermediate" | "advanced" | null;
  availableDays: number[];
  safety: SafetyResult;
}

export interface Targets {
  calories_range: [number, number] | null;
  /** The daily target inside the range: the number the meals add up to. */
  calories_kcal?: number | null;
  water_ml: number | null;
  workouts_per_week: number;
}

export interface CalorieTarget {
  /** Daily target, rounded to 50. */
  kcal: number;
  range: [number, number];
  /** Estimated daily energy use before the goal adjustment, rounded to 50. */
  maintenance: number;
  /** Negative = deficit, positive = surplus, 0 = maintain. */
  adjust: number;
  /** Expected change in kg per week from the adjustment (negative = loss). */
  kgPerWeek: number;
  /** True when sex was given, so one equation was used and the range is narrow. */
  precise: boolean;
}

const round50 = (n: number) => Math.round(n / 50) * 50;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Daily calorie target for the user's goal.
 *
 * - Daily energy use: Mifflin-St Jeor (1990), the most accurate of the common equations in a
 *   systematic review (Frankenfield 2005), times the reported activity level.
 * - Weight loss: a deficit sized for about 0.5% of body weight a week, the low end of the
 *   0.5–1% range that helps keep muscle (Helms 2014). Held between 300 and 600 kcal and never
 *   more than a quarter of daily use. 90 kg → about 500 kcal a day → about 0.45 kg a week.
 * - Muscle or weight gain: a small surplus of about 10% (200–400 kcal) to limit fat gain
 *   (Iraki 2019).
 */
export function calorieTarget(input: TargetInput): CalorieTarget | null {
  const { age, heightCm: h, weightKg: w, safety } = input;
  if (safety.restrictions.noCalorieTarget) return null;
  if (!age || !h || !w) return null;
  const base = 10 * w + 6.25 * h - 5 * age;
  const factor = ACTIVITY_FACTOR[input.activityLevel ?? ""] ?? ACTIVITY_FACTOR.light;
  const male = (base + 5) * factor;
  const female = (base - 161) * factor;
  const maintenance = input.sex === "male" ? male : input.sex === "female" ? female : (male + female) / 2;

  const goal = input.goals[0];
  let adjust = 0;
  if (goal === "lose_weight" && !safety.restrictions.noWeightLossGoal) {
    const forHalfPercent = (w * 0.005 * KCAL_PER_KG) / 7;
    adjust = -Math.min(clamp(forHalfPercent, 300, 600), maintenance * 0.25);
  } else if (goal === "gain_weight" || goal === "muscle") {
    adjust = clamp(maintenance * 0.1, 200, 400);
  }
  adjust = round50(adjust);

  const kcal = Math.max(MIN_CALORIES, round50(maintenance + adjust));
  const precise = Boolean(input.sex);
  const range: [number, number] = precise
    ? [Math.max(MIN_CALORIES, kcal - 100), kcal + 100]
    : [Math.max(MIN_CALORIES, round50(female + adjust)), Math.max(MIN_CALORIES, round50(male + adjust))];
  if (range[1] < range[0] + 100) range[1] = range[0] + 100;
  return {
    kcal,
    range,
    maintenance: round50(maintenance),
    adjust,
    kgPerWeek: Math.round(((adjust * 7) / KCAL_PER_KG) * 100) / 100,
    precise,
  };
}

export function caloriesRange(input: TargetInput): [number, number] | null {
  return calorieTarget(input)?.range ?? null;
}

export function workoutsPerWeek(input: TargetInput): number {
  const r = input.safety.restrictions;
  if (r.noWorkouts) return 0;
  const byExperience = input.experience === "beginner" || !input.experience ? 3 : 4;
  const cap = r.lowIntensityOnly ? 3 : byExperience;
  const days = input.availableDays.length || 3;
  return Math.min(cap, days);
}

export function computeTargets(input: TargetInput): Targets {
  const cal = calorieTarget(input);
  return {
    calories_range: cal?.range ?? null,
    calories_kcal: cal?.kcal ?? null,
    water_ml: dailyWaterTargetMl({
      weightKg: input.weightKg,
      workoutToday: false,
      medicalRestriction: Boolean(input.safety.reasons.includes("medical_condition") || input.safety.reasons.includes("medical_restriction")),
    }),
    workouts_per_week: workoutsPerWeek(input),
  };
}
