/**
 * Weekly targets (spec §7 step 3), computed in code and never by the model.
 *
 * Calories are shown as a range, not an exact number. The questionnaire does not ask for sex,
 * so the range spans the two Mifflin-St Jeor equations (the common clinical estimate of resting
 * energy use), multiplied by the reported activity level and adjusted gently for the goal.
 * No range is given when the safety screen says so, or when the data is missing.
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

/** A moderate deficit or surplus. Never a crash diet. */
const LOSE_ADJUST = -400;
const GAIN_ADJUST = 300;
/** Lower bound so the range never suggests very low intake. */
const MIN_CALORIES = 1400;

export interface TargetInput {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goals: GoalType[];
  experience: "beginner" | "intermediate" | "advanced" | null;
  availableDays: number[];
  safety: SafetyResult;
}

export interface Targets {
  calories_range: [number, number] | null;
  water_ml: number | null;
  workouts_per_week: number;
}

const round50 = (n: number) => Math.round(n / 50) * 50;

export function caloriesRange(input: TargetInput): [number, number] | null {
  const { age, heightCm: h, weightKg: w, safety } = input;
  if (safety.restrictions.noCalorieTarget) return null;
  if (!age || !h || !w) return null;
  const base = 10 * w + 6.25 * h - 5 * age;
  const factor = ACTIVITY_FACTOR[input.activityLevel ?? ""] ?? ACTIVITY_FACTOR.light;
  const goal = input.goals[0];
  const adjust =
    goal === "lose_weight" && !safety.restrictions.noWeightLossGoal
      ? LOSE_ADJUST
      : goal === "gain_weight" || goal === "muscle"
        ? GAIN_ADJUST
        : 0;
  const low = Math.max(MIN_CALORIES, round50((base - 161) * factor + adjust));
  const high = Math.max(low + 100, round50((base + 5) * factor + adjust));
  return [low, high];
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
  return {
    calories_range: caloriesRange(input),
    water_ml: dailyWaterTargetMl({
      weightKg: input.weightKg,
      workoutToday: false,
      medicalRestriction: Boolean(input.safety.reasons.includes("medical_condition") || input.safety.reasons.includes("medical_restriction")),
    }),
    workouts_per_week: workoutsPerWeek(input),
  };
}
