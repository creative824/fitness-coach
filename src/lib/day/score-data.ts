import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DailyPart } from "./scores";

/** A day's score as it was saved on that day. */
export interface SavedScore {
  score: number;
  points: Partial<Record<DailyPart, number | null>>;
  kcalTarget: number | null;
  proteinTarget: number | null;
}

export function savedScoreOf(v: unknown): SavedScore | null {
  const s = v as Partial<SavedScore> | null;
  if (!s || typeof s.score !== "number") return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(s.score))),
    points: s.points && typeof s.points === "object" ? s.points : {},
    kcalTarget: typeof s.kcalTarget === "number" ? s.kcalTarget : null,
    proteinTarget: typeof s.proteinTarget === "number" ? s.proteinTarget : null,
  };
}

/** Saved daily scores between two dates. Empty when the 0011 migration has not run. */
export async function loadScores(userId: string, from: string, to: string): Promise<Map<string, SavedScore>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("day_logs").select("date, score").eq("user_id", userId).gte("date", from).lte("date", to);
  const out = new Map<string, SavedScore>();
  if (error) return out;
  for (const r of data ?? []) {
    const s = savedScoreOf(r.score);
    if (s) out.set(r.date as string, s);
  }
  return out;
}
