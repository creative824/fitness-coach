import "server-only";
import { addDays } from "@/lib/plan/week";
import { createClient } from "@/lib/supabase/server";
import type { DayScore, WeightEntry } from "./trend";

export interface ProgressData {
  weights: WeightEntry[];
  days: DayScore[];
  workoutsDone: number;
  workoutsPlanned: number;
  hideWeight: boolean;
}

/** Last 12 weeks of weight and last 14 days of tasks, read in parallel. */
export async function loadProgress(userId: string, today: string): Promise<ProgressData> {
  const supabase = await createClient();
  const from14 = addDays(today, -13);
  const [profile, weights, tasks] = await Promise.all([
    supabase.from("profiles").select("safety_flags").eq("user_id", userId).maybeSingle(),
    supabase.from("weight_logs").select("date, weight_kg").eq("user_id", userId).gte("date", addDays(today, -84)).order("date"),
    supabase
      .from("daily_tasks")
      .select("date, type, points, status, plans!inner(status), task_completions(points_awarded)")
      .eq("user_id", userId)
      .eq("plans.status", "active")
      .gte("date", from14)
      .lte("date", today),
  ]);
  for (const r of [profile, weights, tasks]) if (r.error) throw new Error(r.error.message);

  const flags = profile.data?.safety_flags as { result?: { restrictions?: { hideWeightTracking?: boolean } } } | null;
  const byDay = new Map<string, DayScore>();
  for (let i = 0; i < 14; i++) {
    const date = addDays(from14, i);
    byDay.set(date, { date, earned: 0, possible: 0, done: 0, total: 0 });
  }
  let workoutsDone = 0;
  let workoutsPlanned = 0;
  type Row = { date: string; type: string; points: number; status: string; task_completions: { points_awarded: number } | { points_awarded: number }[] | null };
  for (const r of (tasks.data ?? []) as unknown as Row[]) {
    const d = byDay.get(r.date);
    if (!d || r.status === "skipped") continue;
    const c = Array.isArray(r.task_completions) ? r.task_completions[0] : r.task_completions;
    d.possible += r.points;
    d.total += 1;
    if (c) {
      d.earned += c.points_awarded;
      d.done += 1;
    }
    if (r.type === "workout") {
      workoutsPlanned += 1;
      if (c) workoutsDone += 1;
    }
  }

  return {
    weights: (weights.data ?? []).map((w) => ({ date: w.date, weight_kg: Number(w.weight_kg) })),
    days: [...byDay.values()],
    workoutsDone,
    workoutsPlanned,
    hideWeight: Boolean(flags?.result?.restrictions?.hideWeightTracking),
  };
}
