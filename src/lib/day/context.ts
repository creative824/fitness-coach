import "server-only";
import { cache } from "react";
import type { DietProfile } from "@/lib/menu/engine";
import { loadOnboarding } from "@/lib/onboarding/data";
import type { OnboardingDraft } from "@/lib/onboarding/schema";
import { calorieTarget } from "@/lib/plan/targets";
import { screenSafety } from "@/lib/safety/screen";
import { createClient } from "@/lib/supabase/server";

/** Used only to size the menu when no calorie target may be shown (safety screen). */
const FALLBACK_KCAL = 2000;

export interface DayContext {
  draft: OnboardingDraft;
  ready: boolean;
  /** The daily calorie target, or null when the safety screen says not to show one. */
  target: number | null;
  /** The calories the menu is built for: the target, or a neutral size without one. */
  menuKcal: number;
  profile: DietProfile;
  mealsPerDay: number | null;
  /** Calorie numbers are shown only with tracking on and a target allowed. */
  showNumbers: boolean;
  hideWeight: boolean;
  heightCm: number | null;
  weightKg: number | null;
}

/** Everything the today screen and the menu actions need about the user, read once per request. */
export const loadDayContext = cache(async (userId: string): Promise<DayContext> => {
  const supabase = await createClient();
  const [state, { data: profile }, { data: lastWeight }] = await Promise.all([
    loadOnboarding(userId),
    supabase.from("profiles").select("calorie_tracking").eq("user_id", userId).maybeSingle(),
    supabase.from("weight_logs").select("weight_kg").eq("user_id", userId).order("date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const d = state.draft;
  const safety = screenSafety(d);
  const weightKg = lastWeight?.weight_kg ? Number(lastWeight.weight_kg) : d.weight_kg;
  const cal = calorieTarget({
    age: d.age,
    heightCm: d.height_cm,
    weightKg,
    sex: d.sex,
    activityLevel: d.activity_level,
    goals: d.goals,
    experience: d.experience,
    availableDays: d.available_days,
    safety,
  });
  const tracking = (profile as { calorie_tracking?: boolean } | null)?.calorie_tracking !== false;
  return {
    draft: d,
    ready: Boolean(state.completedAt),
    target: cal?.kcal ?? null,
    menuKcal: cal?.kcal ?? FALLBACK_KCAL,
    profile: { pattern: d.dietary_pattern, allergies: d.allergies, avoid: [...d.dislikes, ...d.sensitivities] },
    mealsPerDay: d.meals_per_day,
    showNumbers: tracking && Boolean(cal),
    hideWeight: safety.restrictions.hideWeightTracking,
    heightCm: d.height_cm,
    weightKg,
  };
});
