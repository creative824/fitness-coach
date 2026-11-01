/**
 * Step 6 of the plan engine: consistency check (spec §7). A plan that fails is never saved.
 * Checks the schema, then that every id comes from the user's filtered candidates (so no
 * allergen, missing equipment or contraindicated exercise can slip in), and the safety rules.
 */
import type { SafetyResult } from "@/lib/safety/screen";
import type { ExerciseCandidate, MealCandidate } from "./candidates";
import { toMinutes, totalSeconds, warmupSeconds } from "./duration";
import { weeklyPlanSchema, type WeeklyPlan } from "./schema";
import { weekDates } from "./week";

export interface ValidationContext {
  weekStart: string;
  exercises: ExerciseCandidate[];
  meals: MealCandidate[];
  allergies: string[];
  safety: SafetyResult;
  /** Minutes a session may take. When set, no workout may be longer. */
  sessionMinutes?: number | null;
}

export type ValidationResult = { ok: true; plan: WeeklyPlan } | { ok: false; issues: string[] };

export function validatePlan(raw: unknown, ctx: ValidationContext): ValidationResult {
  const parsed = weeklyPlanSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const plan = parsed.data;
  const issues: string[] = [];
  const exercises = new Map(ctx.exercises.map((e) => [e.id, e]));
  const meals = new Map(ctx.meals.map((m) => [m.id, m]));
  const allergies = new Set(ctx.allergies);
  const r = ctx.safety.restrictions;

  if (plan.week_start !== ctx.weekStart) issues.push("week_start does not match");
  const dates = weekDates(ctx.weekStart);
  plan.days.forEach((day, i) => {
    if (day.date !== dates[i]) issues.push(`day ${i}: wrong date ${day.date}`);
    for (const meal of day.meals) {
      for (const id of [meal.meal_idea_id, ...meal.alternatives]) {
        const m = meals.get(id);
        if (!m) issues.push(`day ${i}: unknown meal ${id}`);
        else if (m.allergens.some((a) => allergies.has(a))) issues.push(`day ${i}: allergen in ${m.slug}`);
      }
    }
    if (day.workout) {
      if (r.noWorkouts) issues.push(`day ${i}: workout despite safety referral`);
      if (day.is_rest_day) issues.push(`day ${i}: rest day with a workout`);
      for (const b of day.workout.blocks) {
        const e = exercises.get(b.exercise_id);
        if (!e) issues.push(`day ${i}: exercise ${b.exercise_id} is not allowed for this user`);
        else if (r.lowIntensityOnly && e.difficulty !== "beginner") issues.push(`day ${i}: ${e.slug} too hard`);
      }
      // Follow-up spec §4: estimated_total_duration <= user_available_minutes, and the shown
      // total must be the real total of the blocks.
      const w = day.workout;
      if (ctx.sessionMinutes) {
        const budget = ctx.sessionMinutes;
        const real = toMinutes(totalSeconds(w.blocks, warmupSeconds(budget), (id) => exercises.get(id)?.slug));
        if (w.estimated_minutes > budget) issues.push(`day ${i}: ${w.estimated_minutes} minutes is over the ${budget} the user has`);
        if (real !== w.estimated_minutes) issues.push(`day ${i}: shown ${w.estimated_minutes} minutes but the blocks take ${real}`);
      }
    }
  });
  const workouts = plan.days.filter((d) => d.workout).length;
  if (workouts !== plan.targets.workouts_per_week) issues.push("workout count does not match the target");
  if (r.noCalorieTarget && plan.targets.calories_range) issues.push("calorie range despite safety restriction");

  return issues.length ? { ok: false, issues } : { ok: true, plan };
}
