/**
 * Safety screen (spec §6, §7 step 2). Pure and deterministic: no AI involved.
 *
 * - "clear":   normal plan.
 * - "caution": plan with restrictions (e.g. no calorie target, low intensity) + advice to consult a professional.
 * - "refer":   warning signs during exertion. Only gentle habits (water, sleep, light walking if cleared)
 *              until a doctor approves exercise. No workouts, no calorie target.
 *
 * Wording shown to users lives in src/lib/i18n/he.ts (safety.reasons.*).
 */
import type { GoalType, SafetyQuestion } from "@/lib/onboarding/schema";

export type SafetyLevel = "clear" | "caution" | "refer";

export type SafetyReason =
  | SafetyQuestion
  | "low_bmi_weight_loss"
  | "target_below_healthy_range";

export interface SafetyRestrictions {
  noWorkouts: boolean;
  lowIntensityOnly: boolean;
  noCalorieTarget: boolean;
  noWeightLossGoal: boolean;
  hideWeightTracking: boolean;
}

export interface SafetyResult {
  level: SafetyLevel;
  reasons: SafetyReason[];
  restrictions: SafetyRestrictions;
}

export interface SafetyInput {
  answers: Partial<Record<SafetyQuestion, boolean | null>>;
  goals: GoalType[];
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
}

export function bmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** BMI 18.5 is the WHO lower bound of the normal range for adults. */
export const MIN_HEALTHY_BMI = 18.5;

export function screenSafety(input: SafetyInput): SafetyResult {
  const a = input.answers;
  const reasons: SafetyReason[] = [];
  const r: SafetyRestrictions = {
    noWorkouts: false,
    lowIntensityOnly: false,
    noCalorieTarget: false,
    noWeightLossGoal: false,
    hideWeightTracking: false,
  };
  let level: SafetyLevel = "clear";
  const raise = (to: SafetyLevel) => {
    const rank = { clear: 0, caution: 1, refer: 2 } as const;
    if (rank[to] > rank[level]) level = to;
  };

  // Warning signs during exertion: refer before any exercise programme.
  if (a.chest_pain) {
    reasons.push("chest_pain");
    raise("refer");
  }
  if (a.fainting) {
    reasons.push("fainting");
    raise("refer");
  }
  if (a.chest_pain || a.fainting) {
    r.noWorkouts = true;
    r.lowIntensityOnly = true;
    r.noCalorieTarget = true;
    r.noWeightLossGoal = true;
  }

  if (a.eating_disorder) {
    reasons.push("eating_disorder");
    raise("caution");
    r.noCalorieTarget = true;
    r.noWeightLossGoal = true;
    r.hideWeightTracking = true;
  }
  if (a.pregnancy) {
    reasons.push("pregnancy");
    raise("caution");
    r.noCalorieTarget = true;
    r.noWeightLossGoal = true;
    r.lowIntensityOnly = true;
  }
  if (a.medical_condition) {
    reasons.push("medical_condition");
    raise("caution");
    r.lowIntensityOnly = true;
  }
  if (a.medical_restriction) {
    reasons.push("medical_restriction");
    raise("caution");
    r.lowIntensityOnly = true;
    r.noCalorieTarget = true;
  }
  if (a.active_injury) {
    reasons.push("active_injury");
    raise("caution");
    r.lowIntensityOnly = true;
  }

  const { height_cm: h, weight_kg: w, target_weight_kg: t } = input;
  if (h && w && input.goals.includes("lose_weight") && bmi(h, w) < MIN_HEALTHY_BMI) {
    reasons.push("low_bmi_weight_loss");
    raise("caution");
    r.noWeightLossGoal = true;
    r.noCalorieTarget = true;
  }
  if (h && t && bmi(h, t) < MIN_HEALTHY_BMI) {
    reasons.push("target_below_healthy_range");
    raise("caution");
    r.noWeightLossGoal = true;
  }

  return { level, reasons, restrictions: r };
}

/** Goals that remain after applying restrictions (weight loss is dropped when not appropriate). */
export function allowedGoals(goals: GoalType[], result: SafetyResult): GoalType[] {
  return result.restrictions.noWeightLossGoal ? goals.filter((g) => g !== "lose_weight") : goals;
}
