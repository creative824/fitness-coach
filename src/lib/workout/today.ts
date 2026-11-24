/**
 * Today's workout as stored with the day (day_logs.fitness): the version the user edited on the
 * home screen, and the guided sessions finished today. Parsing is strict so a broken value is
 * dropped rather than shown. Pure.
 */
import { DURATIONS, type Duration, type WorkoutItem } from "./build";

/** What the screens show about an exercise: the name, muscles, how to do it. */
export interface ExerciseCard {
  name: string;
  primary: string[];
  steps: string[];
  cautions: string | null;
  perSide: boolean;
}

export interface StoredWorkout {
  /** The length chosen (5–30 minutes), or null when the exercises were edited by hand. */
  minutes: Duration | null;
  items: WorkoutItem[];
}

export interface StoredSession {
  /** When "סיימתי אימון" was pressed (ISO). */
  at: string;
  exercises: number;
  done: number;
  sets: number;
  reps: number;
  minutes: number;
}

export const MAX_ITEMS = 10;

const int = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export function itemOf(v: unknown): WorkoutItem | null {
  const i = v as Partial<WorkoutItem> | null;
  if (!i || typeof i.slug !== "string" || !/^[a-z0-9-]{2,60}$/.test(i.slug)) return null;
  if (!int(i.sets, 1, 6) || !int(i.rest, 0, 300)) return null;
  const reps = int(i.reps, 1, 50) ? i.reps : undefined;
  const seconds = int(i.seconds, 5, 300) ? i.seconds : undefined;
  if (!reps === !seconds) return null;
  return { slug: i.slug, sets: i.sets!, rest: i.rest!, ...(reps ? { reps } : { seconds }) };
}

export function storedWorkoutOf(v: unknown): StoredWorkout | undefined {
  const w = v as Partial<StoredWorkout> | null;
  if (!w || !Array.isArray(w.items)) return undefined;
  const items = w.items.map(itemOf).filter((x): x is WorkoutItem => x !== null).slice(0, MAX_ITEMS);
  if (!items.length) return undefined;
  const minutes = (DURATIONS as readonly number[]).includes(w.minutes as number) ? (w.minutes as Duration) : null;
  return { minutes, items };
}

export function sessionsOf(v: unknown): StoredSession[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is StoredSession => x && typeof x.at === "string" && [x.exercises, x.done, x.sets, x.reps, x.minutes].every((n) => typeof n === "number"))
    .slice(-5);
}

/** The closest length on offer to a number of minutes (the plan's estimate, say). */
export function nearestDuration(minutes: number): Duration {
  return DURATIONS.reduce((a, b) => (Math.abs(b - minutes) < Math.abs(a - minutes) ? b : a));
}
