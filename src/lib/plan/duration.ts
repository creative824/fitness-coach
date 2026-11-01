/**
 * Workout length (follow-up spec §4). The time the user said they have is a hard limit, not a
 * preference: the total of a workout, warm-up, rests and moving between exercises included,
 * must fit in it. `fitBlocks` trims a workout until it does; it never stretches past the limit.
 * A longer "full" version can still be shown, but only when the user asks for it.
 */

export interface TimedBlock {
  exercise_id: string;
  sets: number;
  reps?: number;
  seconds?: number;
  rest_seconds: number;
  note?: string;
}

/** About three seconds a rep: one down, a short pause, one up. */
export const REP_SECONDS = 3;
/** Getting from one exercise to the next. */
export const TRANSITION_SECONDS = 15;
const MIN_REST = 30;
const MIN_REPS = 6;
const MIN_HOLD = 15;

/** Exercises done on one side and then the other ("מחליפים צד"): each set takes twice as long. */
export const PER_SIDE = new Set([
  "reverse-lunge",
  "step-up",
  "db-row",
  "side-plank-knee",
  "hip-flexor-stretch",
  "hamstring-stretch",
  "doorway-chest-stretch",
  "thoracic-rotation",
]);

/** A short warm-up that grows with the time available. */
export function warmupSeconds(budgetMinutes: number): number {
  if (budgetMinutes <= 15) return 60;
  if (budgetMinutes <= 30) return 120;
  return 240;
}

export function blockSeconds(b: TimedBlock, slug?: string): number {
  const work = (b.seconds ?? (b.reps ?? 10) * REP_SECONDS) * (slug && PER_SIDE.has(slug) ? 2 : 1);
  return b.sets * work + (b.sets - 1) * b.rest_seconds;
}

/** Total seconds: warm-up, every set, rests between sets and moving between exercises. */
export function totalSeconds(blocks: TimedBlock[], warmup: number, slugOf: (id: string) => string | undefined = () => undefined): number {
  if (!blocks.length) return 0;
  return warmup + blocks.reduce((s, b) => s + blockSeconds(b, slugOf(b.exercise_id)), 0) + (blocks.length - 1) * TRANSITION_SECONDS;
}

export const toMinutes = (seconds: number) => Math.ceil(seconds / 60);

/**
 * Trims a workout until its total fits in `budgetMinutes`, in the order that keeps the most
 * training value: shorter rests, then fewer sets, then fewer reps or a shorter hold, and only
 * then fewer exercises. Returns null only if not even one short exercise fits.
 */
export function fitBlocks(
  blocks: TimedBlock[],
  budgetMinutes: number,
  slugOf: (id: string) => string | undefined = () => undefined,
): TimedBlock[] | null {
  const warmup = warmupSeconds(budgetMinutes);
  const limit = budgetMinutes * 60;
  const out = blocks.map((b) => ({ ...b }));
  const fits = () => out.length > 0 && totalSeconds(out, warmup, slugOf) <= limit;
  if (fits()) return out;

  // 1. Shorter rests, 15 seconds at a time.
  while (!fits() && out.some((b) => b.rest_seconds > MIN_REST)) {
    for (const b of out) b.rest_seconds = Math.max(MIN_REST, b.rest_seconds - 15);
  }
  // 2. One set less, starting from the last exercise, down to one set each.
  while (!fits() && out.some((b) => b.sets > 1)) {
    const b = [...out].reverse().find((x) => x.sets === Math.max(...out.map((y) => y.sets)))!;
    b.sets -= 1;
  }
  // 3. Fewer reps or a shorter hold.
  while (!fits() && out.some((b) => (b.reps ?? 0) > MIN_REPS || (b.seconds ?? 0) > MIN_HOLD)) {
    for (const b of out) {
      if (b.reps !== undefined) b.reps = Math.max(MIN_REPS, b.reps - 2);
      if (b.seconds !== undefined) b.seconds = Math.max(MIN_HOLD, b.seconds - 5);
    }
  }
  // 4. Drop exercises from the end.
  while (!fits() && out.length > 1) out.pop();
  return fits() ? out : null;
}
