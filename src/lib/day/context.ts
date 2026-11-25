import "server-only";
import { cache } from "react";
import type { DietProfile } from "@/lib/menu/engine";
import type { Taste } from "@/lib/food/prefs";
import { loadOnboarding } from "@/lib/onboarding/data";
import type { OnboardingDraft } from "@/lib/onboarding/schema";
import { proteinTarget } from "@/lib/day/scores";
import { calorieTarget, type CalorieTarget } from "@/lib/plan/targets";
import { localDay } from "@/lib/water/time";
import { screenSafety } from "@/lib/safety/screen";
import { createClient } from "@/lib/supabase/server";

/** Used when the profile lacks age, height or weight: an average adult day until it is filled in. */
const FALLBACK_KCAL = 2000;

export interface DayContext {
  draft: OnboardingDraft;
  ready: boolean;
  /** The daily calorie target, or null when no numbers may be shown (eating disorder answer). */
  target: number | null;
  /** How the target was set: personal (deficit/surplus by goal), maintenance only (health answers), or a placeholder. */
  targetKind: "personal" | "maintenance" | "placeholder";
  /** The calories the menu is built for: the target, or a neutral size without one. */
  menuKcal: number;
  profile: DietProfile;
  /** What the user likes, does not like and does not eat (meal ideas, menu). */
  taste: Taste;
  /** Meal ideas the user saved for later ("שמירה כרעיון"), newest first. */
  savedIdeas: string[];
  mealsPerDay: number | null;
  /** Calories the user set by hand per meal of the day (null: the usual share). */
  slotKcal: (number | null)[] | null;
  /** Calorie numbers are shown unless tracking is off or the safety screen hides them (eating disorder). */
  showNumbers: boolean;
  hideWeight: boolean;
  heightCm: number | null;
  weightKg: number | null;
  /** What the health answers allow for movement. */
  lowIntensityOnly: boolean;
  needsDoctor: boolean;
  /** Whole weeks since onboarding was completed, for gradual step-ups. */
  weeksIn: number;
  /** Grams of protein a day, or null without a weight or with numbers hidden. */
  protein: number | null;
  /** The full calorie calculation (BMR, daily use, pace to the goal), when there is one. */
  calc: CalorieTarget | null;
}

/** Everything the today screen and the menu actions need about the user, read once per request. */
export const loadDayContext = cache(async (userId: string): Promise<DayContext> => {
  const supabase = await createClient();
  const [state, { data: profile }, { data: lastWeight }] = await Promise.all([
    loadOnboarding(userId),
    supabase.from("profiles").select("calorie_tracking, preferences").eq("user_id", userId).maybeSingle(),
    supabase.from("weight_logs").select("weight_kg").eq("user_id", userId).order("date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const d = state.draft;
  const safety = screenSafety(d);
  const weightKg = lastWeight?.weight_kg ? Number(lastWeight.weight_kg) : d.weight_kg;
  const input = {
    age: d.age,
    heightCm: d.height_cm,
    weightKg,
    sex: d.sex,
    activityLevel: d.activity_level,
    goals: d.goals,
    experience: d.experience,
    availableDays: d.available_days,
    safety,
    targetWeightKg: d.target_weight_kg,
    targetDate: d.target_date,
    today: localDay(new Date()).date,
  };
  const hideNumbers = safety.reasons.includes("eating_disorder");
  let cal = calorieTarget(input);
  let targetKind: DayContext["targetKind"] = "personal";
  if (!cal && !hideNumbers && safety.restrictions.noCalorieTarget) {
    // Health answers (pregnancy, a medical restriction...) rule out a deficit, not counting:
    // the target is the maintenance level, with no weight-loss adjustment.
    cal = calorieTarget({ ...input, safety: { ...safety, restrictions: { ...safety.restrictions, noCalorieTarget: false, noWeightLossGoal: true } } });
    targetKind = "maintenance";
  }
  const kcal = cal?.kcal ?? FALLBACK_KCAL;
  if (!cal) targetKind = "placeholder";
  const prefs = (profile as { calorie_tracking?: boolean; preferences?: { slot_kcal?: unknown; saved_ideas?: unknown } } | null) ?? null;
  const rawIdeas = prefs?.preferences?.saved_ideas;
  const savedIdeas = Array.isArray(rawIdeas) ? rawIdeas.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
  const tracking = prefs?.calorie_tracking !== false;
  const rawSlots = prefs?.preferences?.slot_kcal;
  const slotKcal = Array.isArray(rawSlots) ? rawSlots.map((x) => (typeof x === "number" ? x : null)) : null;
  return {
    draft: d,
    ready: Boolean(state.completedAt),
    target: hideNumbers ? null : kcal,
    targetKind,
    menuKcal: kcal,
    profile: { pattern: d.dietary_pattern, allergies: d.allergies, avoid: [...d.dislikes, ...d.never_eat, ...d.sensitivities] },
    taste: { likes: d.likes, dislikes: d.dislikes, never: d.never_eat },
    savedIdeas,
    mealsPerDay: d.meals_per_day,
    slotKcal,
    showNumbers: tracking && !hideNumbers,
    hideWeight: safety.restrictions.hideWeightTracking,
    heightCm: d.height_cm,
    weightKg,
    lowIntensityOnly: safety.restrictions.lowIntensityOnly,
    needsDoctor: safety.level === "refer",
    weeksIn: state.completedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(state.completedAt)) / (7 * 86_400_000))) : 0,
    protein: tracking && !hideNumbers ? proteinTarget(d.goals, weightKg, { heightCm: d.height_cm, activityLevel: d.activity_level }) : null,
    calc: cal,
  };
});
