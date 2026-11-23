/**
 * The two scores of the day and the week, 0–100. Pure, so the server, the today screen and the
 * tests share them.
 *
 * - Calorie score: how close the day's eating is to the calorie target. Within 10% either way is
 *   a full score; it falls to 0 at 40% off. While the day is still going, eating less than the
 *   target so far is not a miss: the score is how much of the target has been eaten.
 * - Tasks score: the whole day in one number. Calories (30%), protein against the day's protein
 *   target (30%) and the day's actions (40%): exercises of the workout and the small daily tasks
 *   (walk, sleep, logging...). A part with no data (numbers hidden, no weight) is left out and
 *   the others share its weight.
 * - A week's score is the average of the days that have one.
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
 * Grams of protein a day: about 1.6 g per kg to build muscle, 1.4 for strength or weight gain,
 * 1.2 while losing weight (to keep muscle) and 1.0 otherwise. Rounded to 5 g.
 */
export function proteinTarget(goals: GoalType[], weightKg: number | null): number | null {
  if (!weightKg) return null;
  const per = goals.includes("muscle") ? 1.6 : goals.includes("strength") || goals.includes("gain_weight") ? 1.4 : goals.includes("lose_weight") ? 1.2 : 1.0;
  return Math.round((weightKg * per) / 5) * 5;
}

export interface TaskScoreInput {
  calorie: number | null;
  protein: { eaten: number; target: number } | null;
  actions: { done: number; total: number };
}

export interface TaskScore {
  score: number | null;
  parts: { calories: number | null; protein: number | null; actions: number | null };
}

export function taskScore({ calorie, protein, actions }: TaskScoreInput): TaskScore {
  const proteinPart = protein && protein.target > 0 ? clamp((protein.eaten / protein.target) * 100) : null;
  const actionsPart = actions.total > 0 ? clamp((actions.done / actions.total) * 100) : null;
  const parts: [number | null, number][] = [
    [calorie, 0.3],
    [proteinPart, 0.3],
    [actionsPart, 0.4],
  ];
  const used = parts.filter(([v]) => v !== null) as [number, number][];
  const weight = used.reduce((a, [, w]) => a + w, 0);
  return {
    score: weight ? clamp(used.reduce((a, [v, w]) => a + v * w, 0) / weight) : null,
    parts: { calories: calorie, protein: proteinPart, actions: actionsPart },
  };
}

export function weekAverage(days: (number | null)[]): number | null {
  const xs = days.filter((x): x is number => x !== null);
  return xs.length ? clamp(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

/** A word for a score, for the gauges. */
export function scoreWord(score: number | null): string {
  if (score === null) return "אין עדיין נתונים";
  if (score >= 85) return "מצוין";
  if (score >= 65) return "טוב";
  if (score >= 40) return "בדרך";
  return "אפשר יותר";
}
