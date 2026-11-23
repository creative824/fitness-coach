/**
 * How many of a day's actions were done: the workout's exercises and the small daily tasks,
 * worked out the same way the today screen does. Pure, for the week's scores.
 */
import { minutesFor, type SmartTask } from "./smart-tasks";

export function countActions(
  tasks: Pick<SmartTask, "id" | "kind" | "minutes" | "grams">[],
  blocks: number,
  fitness: { done: string[]; acts: { kind: string; min: number }[] },
  food: { meals: number; protein: number | null },
): { done: number; total: number } {
  const exercises = fitness.done.filter((k) => k.startsWith("ex:")).length;
  const doneTasks = tasks.filter(
    (t) =>
      fitness.done.includes(`t:${t.id}`) ||
      (t.minutes ? minutesFor(t.kind, fitness.acts) >= t.minutes : false) ||
      (t.kind === "log_food" && food.meals >= 3) ||
      (t.kind === "protein" && Boolean(t.grams) && (food.protein ?? 0) >= (t.grams ?? 0)),
  ).length;
  return { done: Math.min(blocks, exercises) + doneTasks, total: blocks + tasks.length };
}
