/**
 * Step 7: turn a validated plan into daily tasks (spec §12).
 *
 * Points per task type mirror public.task_points() in supabase/migrations/0004_daily_loop.sql.
 * The database is authoritative: it ignores any points sent by the app.
 */
import type { WeeklyPlan } from "./schema";

export type TaskType = "meal" | "workout" | "movement" | "water" | "recovery" | "habit";

export const TASK_POINTS: Record<TaskType, number> = {
  meal: 5,
  workout: 20,
  movement: 5,
  water: 5,
  recovery: 5,
  habit: 5,
};

/** A partial outcome counts half, rounded up. Mirrors the SQL. */
export function pointsFor(type: TaskType, outcome: "done" | "partial" | "swapped"): number {
  const p = TASK_POINTS[type];
  return outcome === "partial" ? Math.ceil(p / 2) : p;
}

export interface TaskDraft {
  date: string;
  type: TaskType;
  title: string;
  ref: Record<string, unknown>;
  sort_order: number;
}

export const SLOT_HE = { breakfast: "ארוחת בוקר", lunch: "ארוחת צהריים", dinner: "ארוחת ערב", snack: "ארוחת ביניים" } as const;

/**
 * sort_order is stable per kind (meals 0–9, workout 10, habits 20+) so a regenerated plan can
 * keep tasks that were already completed in the same place.
 */
export function planToTasks(plan: WeeklyPlan, mealTitles: Map<string, string>): TaskDraft[] {
  const tasks: TaskDraft[] = [];
  plan.days.forEach((day, dayIndex) => {
    day.meals.forEach((meal, i) => {
      const idea = mealTitles.get(meal.meal_idea_id) ?? "";
      tasks.push({
        date: day.date,
        type: "meal",
        title: `${SLOT_HE[meal.slot]}: ${idea}`.slice(0, 200),
        ref: { day: dayIndex, meal: i, meal_idea_id: meal.meal_idea_id },
        sort_order: i,
      });
    });
    if (day.workout) {
      tasks.push({ date: day.date, type: "workout", title: day.workout.title, ref: { day: dayIndex }, sort_order: 10 });
    }
    day.habits.forEach((h, i) => {
      tasks.push({
        date: day.date,
        type: h.type,
        title: h.target ? `${h.title} · ${h.target}` : h.title,
        ref: { day: dayIndex, habit: i },
        sort_order: 20 + i,
      });
    });
  });
  return tasks;
}
