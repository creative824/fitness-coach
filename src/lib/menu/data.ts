import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sessionsOf, storedWorkoutOf, type StoredSession, type StoredWorkout } from "@/lib/workout/today";
import type { DayMenu } from "./engine";

export interface FitnessState {
  /** Keys of exercises marked done: "ex:<block index>". */
  done: string[];
  /** General activities the user added. */
  acts: { id: string; kind: string; min: number }[];
  /** Today's workout as the user set it on the home screen (length, swaps, edits); none = the plan's. */
  workout?: StoredWorkout;
  /** Guided sessions finished today ("סיימתי אימון"), newest last. */
  sessions?: StoredSession[];
  /** Ids of the small tasks given today, so the list holds all day and tomorrow avoids them. */
  tasks?: string[];
}

export interface DayLog {
  /** False when the 0009 migration has not run: nothing of the day is saved. */
  saved: boolean;
  fitness: FitnessState;
}

const EMPTY_FITNESS: FitnessState = { done: [], acts: [] };

function isMenu(v: unknown): v is DayMenu {
  const m = v as DayMenu | null;
  return Boolean(m && (m.v === 1 || m.v === 2) && Array.isArray(m.slots) && typeof m.target === "number");
}

export function fitnessOf(v: unknown): FitnessState {
  const f = (v ?? {}) as Partial<FitnessState>;
  return {
    done: Array.isArray(f.done) ? f.done.filter((x) => typeof x === "string").slice(0, 40) : [],
    acts: Array.isArray(f.acts) ? f.acts.filter((a) => a && typeof a.kind === "string" && typeof a.min === "number").slice(0, 20) : [],
    ...withWorkout(f),
  };
}

function withWorkout(f: Partial<FitnessState>): Pick<FitnessState, "workout" | "sessions"> {
  const workout = storedWorkoutOf(f.workout);
  const sessions = sessionsOf(f.sessions);
  const tasks = Array.isArray(f.tasks) ? f.tasks.filter((t): t is string => typeof t === "string" && /^[a-z_]{2,20}$/.test(t)).slice(0, 6) : [];
  return { ...(workout ? { workout } : {}), ...(sessions.length ? { sessions } : {}), ...(tasks.length ? { tasks } : {}) };
}

/**
 * Today's row (activities, workout, small tasks). No menu is made any more: the food diary shows
 * only what the user ate, and meal ideas are asked for, never planned ahead.
 */
export async function loadDayLog(userId: string, date: string): Promise<DayLog> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("day_logs").select("fitness").eq("user_id", userId).eq("date", date).maybeSingle();
  if (error) return { saved: false, fitness: EMPTY_FITNESS };
  if (data) return { saved: true, fitness: fitnessOf(data.fitness) };
  const write = await supabase.from("day_logs").upsert({ user_id: userId, date }, { onConflict: "user_id,date", ignoreDuplicates: true });
  if (write.error) console.error("day_logs insert failed", write.error.message);
  const { data: again } = await supabase.from("day_logs").select("fitness").eq("user_id", userId).eq("date", date).maybeSingle();
  return { saved: !write.error, fitness: fitnessOf(again?.fitness) };
}

/**
 * Keeps the small tasks given today with the day, the first time the day is opened. Later
 * views show the same tasks, and the next days know what was given. Best effort.
 */
export async function rememberTasks(userId: string, date: string, ids: string[]): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from("day_logs").select("fitness").eq("user_id", userId).eq("date", date).maybeSingle();
  if (!data) return;
  const f = fitnessOf(data.fitness);
  if (f.tasks?.length) return;
  const { error } = await supabase.from("day_logs").update({ fitness: { ...f, tasks: ids } }).eq("user_id", userId).eq("date", date);
  if (error) console.error("remember tasks failed", error.message);
}

/** Days of a range with the targets of their old menus (days before the diary) and activities, for the tracking screens. */
export async function loadDayLogRange(userId: string, from: string, to: string): Promise<Map<string, { target: number | null; fitness: FitnessState }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("day_logs").select("date, menu, fitness").eq("user_id", userId).gte("date", from).lte("date", to);
  const out = new Map<string, { target: number | null; fitness: FitnessState }>();
  if (error) return out;
  for (const r of data ?? []) out.set(r.date as string, { target: isMenu(r.menu) ? r.menu.target : null, fitness: fitnessOf(r.fitness) });
  return out;
}
