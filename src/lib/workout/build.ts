/**
 * Today's workout, built in code from the exercises the user may do (approved, fitting their
 * equipment, level and limitations). Pure, so the home screen, the server and the tests share it.
 *
 * - A workout is balanced across groups: legs, push, pull and core, with cardio or mobility in
 *   longer sessions. No group gets two exercises before every group has one.
 * - The length chosen (5–30 minutes) sets the number of exercises, sets, reps and rests, and the
 *   result always fits in it: rests shorten first, then sets, then exercises are dropped.
 * - Swaps stay in the same group and on the same main muscles; easier and harder versions
 *   follow the library's regressions.
 */

export interface PoolExercise {
  slug: string;
  name: string;
  category: "strength" | "cardio" | "mobility" | "core";
  mode: "reps" | "seconds";
  difficulty: "beginner" | "intermediate" | "advanced";
  primary: string[];
  /** Slug of an easier version, if any. */
  easier: string | null;
}

export interface WorkoutItem {
  slug: string;
  sets: number;
  /** Reps per set, for rep exercises. */
  reps?: number;
  /** Seconds per set, for holds. */
  seconds?: number;
  /** Rest between sets, in seconds. */
  rest: number;
}

export type Group = "legs" | "push" | "pull" | "core" | "cardio" | "mobility";

export const GROUP_LABEL: Record<Group, string> = { legs: "רגליים", push: "דחיפה", pull: "משיכה", core: "ליבה", cardio: "אירובי", mobility: "גמישות" };

export function groupOf(e: Pick<PoolExercise, "category" | "primary">): Group {
  if (e.category === "cardio") return "cardio";
  if (e.category === "mobility") return "mobility";
  const p = e.primary;
  if (e.category === "core" || p.some((m) => m === "abs" || m === "obliques" || m === "lower_back")) return "core";
  if (p.some((m) => m === "quads" || m === "glutes" || m === "hamstrings" || m === "calves" || m === "adductors")) return "legs";
  if (p.some((m) => m === "upper_back" || m === "biceps")) return "pull";
  return "push";
}

export const DURATIONS = [5, 10, 15, 20, 30] as const;
export type Duration = (typeof DURATIONS)[number];

interface Shape {
  groups: Group[];
  sets: number;
  reps: number;
  hold: number;
  rest: number;
}

/** What each length looks like before it is fitted to the clock. */
const SHAPES: Record<Duration, Shape> = {
  5: { groups: ["legs", "push"], sets: 2, reps: 10, hold: 20, rest: 30 },
  10: { groups: ["legs", "push", "core"], sets: 2, reps: 10, hold: 25, rest: 40 },
  15: { groups: ["legs", "push", "pull", "core"], sets: 2, reps: 12, hold: 30, rest: 45 },
  20: { groups: ["legs", "push", "pull", "core", "legs"], sets: 3, reps: 10, hold: 30, rest: 50 },
  30: { groups: ["cardio", "legs", "push", "pull", "core", "mobility"], sets: 3, reps: 12, hold: 40, rest: 60 },
};

/** About three seconds a rep: down, a short pause, up. */
export const REP_SECONDS = 3;
const TRANSITION = 15;
const MIN_REST = 25;

export function itemSeconds(i: WorkoutItem): number {
  const work = i.seconds ?? (i.reps ?? 10) * REP_SECONDS;
  return i.sets * work + (i.sets - 1) * i.rest;
}

export function workoutSeconds(items: WorkoutItem[]): number {
  return items.reduce((a, i) => a + itemSeconds(i), 0) + Math.max(0, items.length - 1) * TRANSITION;
}

export const workoutMinutes = (items: WorkoutItem[]) => Math.max(1, Math.round(workoutSeconds(items) / 60));

function hash(s: string): number {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  return h >>> 0;
}

const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 } as const;

function itemFor(e: PoolExercise, shape: Shape): WorkoutItem {
  if (e.mode === "seconds") return { slug: e.slug, sets: shape.sets, seconds: e.category === "cardio" ? shape.hold + 10 : shape.hold, rest: shape.rest };
  return { slug: e.slug, sets: shape.sets, reps: shape.reps, rest: shape.rest };
}

/** Trims a workout until it fits: shorter rests, then fewer sets, then fewer exercises. */
export function fitToMinutes(items: WorkoutItem[], minutes: number): WorkoutItem[] {
  const limit = minutes * 60;
  let out = items.map((i) => ({ ...i }));
  while (out.length && workoutSeconds(out) > limit) {
    const longRest = out.find((i) => i.rest > MIN_REST);
    if (longRest) {
      for (const i of out) i.rest = Math.max(MIN_REST, i.rest - 5);
      continue;
    }
    const most = out.reduce((a, b) => (b.sets > a.sets ? b : a));
    if (most.sets > 1 && out.every((i) => i.sets >= 2)) {
      most.sets -= 1;
      continue;
    }
    if (out.length > 1) {
      out = out.slice(0, -1);
      continue;
    }
    const only = out[0];
    if (only.reps && only.reps > 6) only.reps -= 2;
    else if (only.seconds && only.seconds > 15) only.seconds -= 5;
    else if (only.sets > 1) only.sets -= 1;
    else break;
  }
  return out;
}

/**
 * A workout of `minutes` from the pool. `seed` makes it change from day to day; the same seed
 * gives the same workout. Prefers exercises at the user's level, then easier ones.
 */
export function buildWorkout(pool: PoolExercise[], minutes: Duration, seed: string, level: PoolExercise["difficulty"] = "beginner"): WorkoutItem[] {
  const shape = SHAPES[minutes];
  const used = new Set<string>();
  const items: WorkoutItem[] = [];
  for (const [k, g] of shape.groups.entries()) {
    const options = pool
      .filter((e) => groupOf(e) === g && !used.has(e.slug) && LEVEL[e.difficulty] <= LEVEL[level])
      .sort((a, b) => LEVEL[b.difficulty] - LEVEL[a.difficulty] || hash(seed + k + a.slug) - hash(seed + k + b.slug));
    // Among the exercises at the highest level available, a daily pick.
    const top = options.filter((e) => e.difficulty === options[0]?.difficulty);
    const e = top.length ? top[hash(seed + g + k) % top.length] : undefined;
    if (!e) continue;
    used.add(e.slug);
    items.push(itemFor(e, shape));
  }
  return fitToMinutes(items, minutes);
}

/** Other exercises for the same group and main muscles, the closest first. */
export function alternatives(pool: PoolExercise[], slug: string, exclude: string[] = []): PoolExercise[] {
  const e = pool.find((x) => x.slug === slug);
  if (!e) return [];
  const g = groupOf(e);
  const shared = (x: PoolExercise) => x.primary.filter((m) => e.primary.includes(m)).length;
  return pool
    .filter((x) => x.slug !== slug && !exclude.includes(x.slug) && groupOf(x) === g && x.mode === e.mode)
    .sort((a, b) => shared(b) - shared(a) || Math.abs(LEVEL[a.difficulty] - LEVEL[e.difficulty]) - Math.abs(LEVEL[b.difficulty] - LEVEL[e.difficulty]))
    .slice(0, 5);
}

export function easierOf(pool: PoolExercise[], slug: string): PoolExercise | null {
  const e = pool.find((x) => x.slug === slug);
  return (e?.easier && pool.find((x) => x.slug === e.easier)) || null;
}

export function harderOf(pool: PoolExercise[], slug: string): PoolExercise | null {
  return pool.find((x) => x.easier === slug) ?? null;
}

export interface Suggestion {
  label: string;
  item: WorkoutItem;
}

/** What to change when an exercise feels too easy or too hard: more or less work, or another version. */
export function suggestions(pool: PoolExercise[], item: WorkoutItem, feel: "easy" | "hard"): Suggestion[] {
  const out: Suggestion[] = [];
  if (feel === "easy") {
    if (item.reps) out.push({ label: `עוד חזרות: ${item.reps + 4} בכל סט`, item: { ...item, reps: Math.min(30, item.reps + 4) } });
    if (item.seconds) out.push({ label: `החזקה ארוכה יותר: ${item.seconds + 10} שניות`, item: { ...item, seconds: Math.min(120, item.seconds + 10) } });
    if (item.sets < 5) out.push({ label: `סט נוסף: ${item.sets + 1} סטים`, item: { ...item, sets: item.sets + 1 } });
    const h = harderOf(pool, item.slug);
    if (h) out.push({ label: `גרסה מאתגרת יותר: ${h.name}`, item: { ...item, slug: h.slug } });
  } else {
    if (item.reps && item.reps > 5) out.push({ label: `פחות חזרות: ${Math.max(5, item.reps - 4)} בכל סט`, item: { ...item, reps: Math.max(5, item.reps - 4) } });
    if (item.seconds && item.seconds > 10) out.push({ label: `החזקה קצרה יותר: ${Math.max(10, item.seconds - 10)} שניות`, item: { ...item, seconds: Math.max(10, item.seconds - 10) } });
    if (item.sets > 1) out.push({ label: `סט אחד פחות: ${item.sets - 1} סטים`, item: { ...item, sets: item.sets - 1 } });
    const e = easierOf(pool, item.slug);
    if (e) out.push({ label: `גרסה קלה יותר: ${e.name}`, item: { ...item, slug: e.slug } });
  }
  return out;
}
