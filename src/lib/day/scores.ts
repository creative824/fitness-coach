/**
 * The day's numbers, pure so the server, the today screen and the tests share them.
 *
 * - Calorie score: how close the day's eating is to the calorie target. Within 10% either way is
 *   a full score; it falls to 0 at 40% off. While the day is still going, eating less than the
 *   target so far is not a miss: the score is how much of the target has been eaten.
 * - Protein target, and the daily score built from both (see dailyScore).
 */
import type { GoalType } from "@/lib/onboarding/schema";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function calorieScore(eaten: number | null, target: number | null, inProgress = false): number | null {
  if (!target || eaten === null || eaten <= 0) return inProgress && target ? 0 : null;
  const ratio = eaten / target;
  if (inProgress && ratio < 0.9) return clamp(ratio * 100);
  const off = Math.abs(ratio - 1);
  if (off <= 0.1) return 100;
  return clamp(100 - ((off - 0.1) / 0.3) * 100);
}

/**
 * Grams of protein a day, from the weight, the goal and the activity level (rounded to 5 g):
 * - per kg: 1.6 to build muscle, 1.4 for strength or weight gain, 1.6 while losing weight (to
 *   keep muscle in a deficit, Helms 2014), 1.0 otherwise; +0.2 for very active people.
 * - With a high BMI the weight used is the one at BMI 27, so the number stays realistic.
 * - Never above 2.2 g per kg.
 */
export function proteinTarget(goals: GoalType[], weightKg: number | null, opts: { heightCm?: number | null; activityLevel?: string | null } = {}): number | null {
  if (!weightKg) return null;
  let per = goals.includes("muscle") ? 1.6 : goals.includes("lose_weight") ? 1.6 : goals.includes("strength") || goals.includes("gain_weight") ? 1.4 : 1.0;
  if (opts.activityLevel === "active" || opts.activityLevel === "very_active") per += 0.2;
  per = Math.min(2.2, per);
  const h = opts.heightCm ? opts.heightCm / 100 : null;
  const ref = h && weightKg / (h * h) > 30 ? 27 * h * h : weightKg;
  return Math.round((ref * per) / 5) * 5;
}

/**
 * The daily score, 0–100 (product spec §4): calories 70, protein 15, fitness 10, daily tasks 5.
 *
 * - Calories: calorieScore() scaled to 70. A full score sits in a band around the target; eating
 *   far below or far above it lowers the score, so eating less never scores more.
 * - Protein: share of the protein target reached, up to 15. Nothing extra above the target.
 * - Fitness: share of the day's workout exercises and movement tasks done, up to 10. A day with
 *   nothing planned is a rest day and counts as done.
 * - Tasks: share of the other daily tasks done, up to 5. No tasks = full.
 * A part with no data (numbers hidden, no weight for protein) is left out and the score is
 * scaled to 100 over the parts that are left.
 */
export const DAILY_WEIGHTS = { calories: 70, protein: 15, fitness: 10, tasks: 5 } as const;
export type DailyPart = keyof typeof DAILY_WEIGHTS;

export interface DailyScoreInput {
  /** calorieScore() of the day, or null when calories are not counted. */
  calorie: number | null;
  protein: { eaten: number; target: number } | null;
  fitness: { done: number; total: number };
  tasks: { done: number; total: number };
}

export interface DailyScore {
  score: number | null;
  /** Points of each part (0..its weight), or null when left out. */
  points: Record<DailyPart, number | null>;
}

const share = (p: { done: number; total: number }) => (p.total > 0 ? Math.min(1, p.done / p.total) : 1);

export function dailyScore({ calorie, protein, fitness, tasks }: DailyScoreInput): DailyScore {
  const frac: Record<DailyPart, number | null> = {
    calories: calorie === null ? null : Math.max(0, Math.min(100, calorie)) / 100,
    protein: protein && protein.target > 0 ? Math.min(1, Math.max(0, protein.eaten) / protein.target) : null,
    fitness: share(fitness),
    tasks: share(tasks),
  };
  const keys = Object.keys(DAILY_WEIGHTS) as DailyPart[];
  const points = Object.fromEntries(keys.map((k) => [k, frac[k] === null ? null : Math.round(frac[k]! * DAILY_WEIGHTS[k])])) as Record<DailyPart, number | null>;
  const used = keys.filter((k) => frac[k] !== null);
  const max = used.reduce((a, k) => a + DAILY_WEIGHTS[k], 0);
  const raw = used.reduce((a, k) => a + frac[k]! * DAILY_WEIGHTS[k], 0);
  return { score: max ? clamp((raw / max) * 100) : null, points };
}
