import "server-only";
import { filterExercises, type ExerciseCandidate } from "@/lib/plan/candidates";
import { PER_SIDE } from "@/lib/plan/duration";
import type { OnboardingDraft } from "@/lib/onboarding/schema";
import { screenSafety } from "@/lib/safety/screen";
import { createClient } from "@/lib/supabase/server";
import type { PoolExercise } from "./build";
import type { ExerciseCard } from "./today";

export type { ExerciseCard };

export interface WorkoutPool {
  pool: PoolExercise[];
  cards: Record<string, ExerciseCard>;
  /** Exercise ids by slug, for the workout history (exercise_logs). */
  ids: Map<string, string>;
}

const COLS = "id, slug, name_he, category, mode, difficulty, equipment, primary_muscles, contraindications, easier_slug, instructions_he, cautions_he";

type Row = ExerciseCandidate & { easier_slug: string | null; instructions_he: string; cautions_he: string | null };

/**
 * The exercises this user may do today: approved, fitting their equipment, level and
 * limitations (the same filter as the weekly plan). Swaps and new workouts come only from here.
 */
export async function loadWorkoutPool(draft: OnboardingDraft): Promise<WorkoutPool> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select(COLS).eq("review_status", "approved");
  if (error) throw new Error(error.message);
  const rows = filterExercises((data ?? []) as Row[], {
    experience: draft.experience,
    location: draft.location,
    equipment: draft.equipment,
    limitations: draft.limitations,
    safety: screenSafety(draft),
  }) as Row[];
  return poolOf(rows);
}

export function poolOf(rows: Row[]): WorkoutPool {
  const slugs = new Set(rows.map((r) => r.slug));
  return {
    pool: rows.map((r) => ({
      slug: r.slug,
      name: r.name_he,
      category: r.category,
      mode: r.mode,
      difficulty: r.difficulty,
      primary: r.primary_muscles,
      easier: r.easier_slug && slugs.has(r.easier_slug) ? r.easier_slug : null,
    })),
    cards: Object.fromEntries(
      rows.map((r) => [
        r.slug,
        { name: r.name_he, primary: r.primary_muscles, steps: r.instructions_he.split("\n").filter(Boolean), cautions: r.cautions_he, perSide: PER_SIDE.has(r.slug) },
      ]),
    ),
    ids: new Map(rows.map((r) => [r.slug, r.id])),
  };
}
