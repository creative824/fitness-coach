"use server";

import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";

const input = z.object({
  exerciseId: z.uuid(),
  date: z.iso.date(),
  feeling: z.enum(["too_easy", "too_hard", "clear"]),
});

/** Effort on the 1–10 scale of exercise_logs, so later plans can use it. */
const EFFORT = { too_easy: 3, too_hard: 9 } as const;

/**
 * "Too easy" / "too hard" on an exercise card. One feedback row per exercise and day: a new
 * tap replaces the previous one, "clear" removes it. Stored in exercise_logs (own rows only).
 */
export async function saveExerciseFeeling(exerciseId: string, date: string, feeling: string): Promise<{ ok: boolean }> {
  const parsed = input.safeParse({ exerciseId, date, feeling });
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const del = await supabase
    .from("exercise_logs")
    .delete()
    .eq("user_id", user.id)
    .eq("exercise_id", parsed.data.exerciseId)
    .eq("date", parsed.data.date)
    .in("notes", ["too_easy", "too_hard"]);
  if (del.error) {
    console.error("exercise feeling delete failed", del.error.message);
    return { ok: false };
  }
  if (parsed.data.feeling === "clear") return { ok: true };
  const { error } = await supabase.from("exercise_logs").insert({
    user_id: user.id,
    exercise_id: parsed.data.exerciseId,
    date: parsed.data.date,
    effort: EFFORT[parsed.data.feeling],
    notes: parsed.data.feeling,
  });
  if (error) console.error("exercise feeling insert failed", error.message);
  return { ok: !error };
}
