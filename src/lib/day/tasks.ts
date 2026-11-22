import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SLOT_HE } from "@/lib/plan/tasks";
import type { SlotType } from "@/lib/menu/engine";

/**
 * Keeps the plan's daily tasks in step with the today screen, so competitions (which score
 * tasks) count what the user did: a menu meal marked eaten completes the matching meal task, a
 * finished workout completes the workout task. Best effort: a failure here never fails the tap.
 */

type Outcome = "pending" | "done" | "partial";

async function setOutcome(supabase: SupabaseClient, taskId: string, outcome: Outcome) {
  const { error } = await supabase.rpc("set_task_outcome", { p_task_id: taskId, p_outcome: outcome });
  if (error) console.error("task sync failed", error.message);
}

async function dayTasks(supabase: SupabaseClient, userId: string, date: string, type: string) {
  const { data } = await supabase
    .from("daily_tasks")
    .select("id, title, status, sort_order, plans!inner(status)")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("type", type)
    .eq("plans.status", "active")
    .order("sort_order");
  return (data ?? []) as { id: string; title: string; status: string }[];
}

/** The nth meal of a kind in the menu (e.g. the second snack) maps to the nth plan task of that kind. */
export async function syncMealTask(supabase: SupabaseClient, userId: string, date: string, type: SlotType, nth: number, eaten: boolean) {
  const prefix = SLOT_HE[type === "snack" ? "snack" : type];
  const tasks = (await dayTasks(supabase, userId, date, "meal")).filter((t) => t.title.startsWith(prefix));
  // Plans with fewer snacks than the menu: extra snacks fall back to any meal task left.
  const task = tasks[nth] ?? (eaten ? (await dayTasks(supabase, userId, date, "meal")).find((t) => t.status === "pending") : undefined);
  if (!task) return;
  if (eaten && task.status === "pending") await setOutcome(supabase, task.id, "done");
  if (!eaten && task.status !== "pending") await setOutcome(supabase, task.id, "pending");
}

/** All exercises done → workout done; at least half → partial; fewer → pending. */
export async function syncWorkoutTask(supabase: SupabaseClient, userId: string, date: string, done: number, total: number) {
  const [task] = await dayTasks(supabase, userId, date, "workout");
  if (!task || total <= 0) return;
  const outcome: Outcome = done >= total ? "done" : done * 2 >= total ? "partial" : "pending";
  if (task.status !== outcome) await setOutcome(supabase, task.id, outcome);
}

/** Any general activity of 10 minutes or more completes the day's movement task. */
export async function syncMovementTask(supabase: SupabaseClient, userId: string, date: string, active: boolean) {
  const [task] = await dayTasks(supabase, userId, date, "movement");
  if (!task) return;
  if (active && task.status === "pending") await setOutcome(supabase, task.id, "done");
}
