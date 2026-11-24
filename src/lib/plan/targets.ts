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

/** Lower bound so the target never suggests very low intake (1,200 for women). */
const MIN_CALORIES = 1400;
const MIN_CALORIES_FEMALE = 1200;
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
  /** Optional goal: the weight to reach and by when (YYYY-MM-DD), measured from `today`. */
  targetWeightKg?: number | null;
  targetDate?: string | null;
  today?: string;
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
  /** Basal metabolic rate (Mifflin-St Jeor), rounded to 10. */
  bmr: number;
  /** The goal check, when a target weight (and maybe a date) was given. */
  pace: GoalPace | null;
}

export interface GoalPace {
  /** kg per week the chosen date needs (negative = loss), or null without a date. */
  neededKgPerWeek: number | null;
  /** The chosen date needs a faster pace than is healthy. */
  tooFast: boolean;
  /** A date at a moderate, healthy pace (YYYY-MM-DD). */
  recommendedDate: string;
  /** When the target weight is reached at the planned pace (YYYY-MM-DD), or null. */
  etaDate: string | null;
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
  const bmrMale = base + 5;
  const bmrFemale = base - 161;
  const bmr = input.sex === "male" ? bmrMale : input.sex === "female" ? bmrFemale : (bmrMale + bmrFemale) / 2;
  const male = bmrMale * factor;
  const female = bmrFemale * factor;
  const maintenance = bmr * factor;

  const goal = input.goals[0];
  const losing = goal === "lose_weight" && !safety.restrictions.noWeightLossGoal;
  const gaining = goal === "gain_weight" || goal === "muscle";
  const maxDeficit = Math.min(maintenance * 0.25, MAX_DEFICIT, (w * SAFE_LOSS_PER_WEEK * KCAL_PER_KG) / 7);
  const pace = goalPace(input, w);
  let adjust = 0;
  if (losing) {
    const forHalfPercent = (w * 0.005 * KCAL_PER_KG) / 7;
    const usual = Math.min(clamp(forHalfPercent, 300, 600), maxDeficit);
    // A chosen date sets the pace, inside the healthy limits; a date too close gets the limit.
    const needed = pace?.neededKgPerWeek != null && pace.neededKgPerWeek < 0 ? (-pace.neededKgPerWeek * KCAL_PER_KG) / 7 : null;
    adjust = -(needed === null ? usual : clamp(needed, 150, maxDeficit));
  } else if (gaining) {
    adjust = clamp(maintenance * 0.1, 200, 400);
  }
  adjust = round50(adjust);

  const floor = input.sex === "female" ? MIN_CALORIES_FEMALE : MIN_CALORIES;
  const kcal = Math.max(Math.min(floor, round50(maintenance)), round50(maintenance + adjust));
  const realAdjust = kcal - round50(maintenance);
  const precise = Boolean(input.sex);
  const range: [number, number] = precise
    ? [Math.max(Math.min(floor, kcal), kcal - 100), kcal + 100]
    : [Math.max(Math.min(floor, kcal), round50(female + realAdjust)), Math.max(kcal, round50(male + realAdjust))];
  if (range[1] < range[0] + 100) range[1] = range[0] + 100;
  const kgPerWeek = Math.round(((realAdjust * 7) / KCAL_PER_KG) * 100) / 100;
  return {
    kcal,
    range,
    maintenance: round50(maintenance),
    adjust: realAdjust,
    kgPerWeek,
    precise,
    bmr: Math.round(bmr / 10) * 10,
    pace: pace ? { ...pace, etaDate: etaOf(input, w, kgPerWeek) } : null,
  };
}

/** The fastest loss the app plans for: 1% of body weight a week, and never more than 1,000 kcal a day. */
export const SAFE_LOSS_PER_WEEK = 0.01;
const MAX_DEFICIT = 1000;
/** The pace a recommended date is built on: 0.7% of body weight a week. */
const MODERATE_LOSS_PER_WEEK = 0.007;
const MODERATE_GAIN_PER_WEEK = 0.0025;

const DAY_MS = 86_400_000;
const addDaysIso = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const daysUntil = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

function goalPace(input: TargetInput, w: number): Omit<GoalPace, "etaDate"> | null {
  const t = input.targetWeightKg;
  if (!t || !input.today || Math.abs(t - w) < 0.5) return null;
  const losing = t < w;
  const perWeek = (losing ? MODERATE_LOSS_PER_WEEK : MODERATE_GAIN_PER_WEEK) * w;
  const recommendedDate = addDaysIso(input.today, Math.ceil((Math.abs(t - w) / perWeek) * 7));
  const days = input.targetDate ? daysUntil(input.today, input.targetDate) : null;
  if (days === null || days <= 0) return { neededKgPerWeek: null, tooFast: days !== null, recommendedDate };
  const needed = ((t - w) / days) * 7;
  const tooFast = losing ? -needed > w * SAFE_LOSS_PER_WEEK : needed > w * 0.005;
  return { neededKgPerWeek: Math.round(needed * 100) / 100, tooFast, recommendedDate };
}

function etaOf(input: TargetInput, w: number, kgPerWeek: number): string | null {
  const t = input.targetWeightKg;
  if (!t || !input.today || !kgPerWeek || Math.sign(t - w) !== Math.sign(kgPerWeek)) return null;
  return addDaysIso(input.today, Math.ceil(((t - w) / kgPerWeek) * 7));
}

/** Minutes of activity a day to aim for, on top of the workouts: more for those who sit most of the day. */
export function activeMinutesTarget(activityLevel: string | null): number {
  return activityLevel === "sedentary" ? 20 : activityLevel === "light" ? 25 : 30;
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
