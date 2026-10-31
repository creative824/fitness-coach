import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rowsToDraft } from "./mapping";
import type { OnboardingDraft } from "./schema";

export interface OnboardingState {
  draft: OnboardingDraft;
  step: number;
  completedAt: string | null;
}

export async function loadOnboarding(userId: string): Promise<OnboardingState> {
  const supabase = await createClient();
  const [profile, food, exercise, goals] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("food_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("exercise_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("goals").select("goal_type, priority").eq("user_id", userId).eq("active", true),
  ]);
  for (const r of [profile, food, exercise, goals]) if (r.error) throw new Error(r.error.message);

  return {
    draft: rowsToDraft(
      { profile: profile.data, food: food.data, exercise: exercise.data, goals: goals.data ?? [] },
      new Date(),
    ),
    step: profile.data?.onboarding_step ?? 0,
    completedAt: profile.data?.onboarding_completed_at ?? null,
  };
}
