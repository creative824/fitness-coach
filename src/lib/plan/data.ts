import "server-only";
import { loadOnboarding } from "@/lib/onboarding/data";
import { screenSafety } from "@/lib/safety/screen";
import { createClient } from "@/lib/supabase/server";
import { filterExercises, filterMeals, type ExerciseCandidate, type MealCandidate } from "./candidates";
import { COMPOSER_ID, composeWeek } from "./generate";
import { weeklyPlanSchema, type WeeklyPlan } from "./schema";
import { planToTasks, type TaskType } from "./tasks";
import { computeTargets } from "./targets";
import { validatePlan } from "./validate";

const EXERCISE_COLS = "id, slug, name_he, category, mode, difficulty, equipment, primary_muscles, contraindications";
const MEAL_COLS = "id, slug, title_he, hint_he, meal_type, portion, dietary_tags, allergens";

export type GenerateResult = { ok: true; planId: string } | { ok: false; reason: "not_ready" | "no_content" | "invalid" | "db" };

/** The whole pipeline: profile → safety → targets → filter → compose → validate → save. */
export async function generateWeekPlan(userId: string, weekStart: string): Promise<GenerateResult> {
  const supabase = await createClient();
  const [state, ex, ml] = await Promise.all([
    loadOnboarding(userId),
    supabase.from("exercises").select(EXERCISE_COLS).eq("review_status", "approved"),
    supabase.from("meal_ideas").select(MEAL_COLS).eq("review_status", "approved"),
  ]);
  if (ex.error || ml.error) return { ok: false, reason: "db" };
  if (!state.completedAt) return { ok: false, reason: "not_ready" };
  const d = state.draft;

  const safety = screenSafety(d);
  const fitness = { experience: d.experience, location: d.location, equipment: d.equipment, limitations: d.limitations, safety };
  const exercises = filterExercises((ex.data ?? []) as ExerciseCandidate[], fitness);
  const meals = filterMeals((ml.data ?? []) as MealCandidate[], {
    dietaryPattern: d.dietary_pattern,
    allergies: d.allergies,
    dislikes: d.dislikes,
  });
  if (!meals.length && !exercises.length) return { ok: false, reason: "no_content" };

  const targets = computeTargets({
    age: d.age,
    heightCm: d.height_cm,
    weightKg: d.weight_kg,
    activityLevel: d.activity_level,
    goals: d.goals,
    experience: d.experience,
    availableDays: d.available_days,
    safety,
  });
  const plan = composeWeek({
    weekStart,
    goals: d.goals,
    safety,
    targets,
    experience: d.experience,
    location: d.location,
    availableDays: d.available_days,
    busyDays: d.busy_days,
    sessionMinutes: d.session_minutes,
    mealsPerDay: d.meals_per_day,
    allergies: d.allergies,
    exercises,
    meals,
  });
  const check = validatePlan(plan, { weekStart, exercises, meals, allergies: d.allergies, safety, sessionMinutes: d.session_minutes ?? 30 });
  if (!check.ok) {
    console.error("plan validation failed", check.issues);
    return { ok: false, reason: "invalid" };
  }

  const tasks = planToTasks(check.plan, new Map(meals.map((m) => [m.id, m.title_he])));
  const { data, error } = await supabase.rpc("save_week_plan", {
    p_week_start: weekStart,
    p_plan: check.plan,
    p_tasks: tasks,
    p_meta: { composer: COMPOSER_ID, safety_level: safety.level, candidates: { exercises: exercises.length, meals: meals.length } },
  });
  if (error) {
    console.error("save_week_plan failed", error.message);
    return { ok: false, reason: "db" };
  }
  return { ok: true, planId: data as string };
}

export interface ExerciseInfo {
  id: string;
  slug: string;
  name_he: string;
  equipment: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions_he: string;
  cautions_he: string | null;
  easier_slug: string | null;
}
export interface MealInfo {
  id: string;
  title_he: string;
  hint_he: string | null;
}

export interface WeekView {
  plan: WeeklyPlan;
  version: number;
  exercises: Map<string, ExerciseInfo>;
  meals: Map<string, MealInfo>;
}

/** The active plan of a week with the names it refers to, or null. */
export async function loadWeek(userId: string, weekStart: string): Promise<WeekView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("plan_json, version")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const parsed = weeklyPlanSchema.safeParse(data.plan_json);
  if (!parsed.success) return null;
  const plan = parsed.data;

  const exerciseIds = [
    ...new Set(plan.days.flatMap((d) => [...(d.workout?.blocks ?? []), ...(d.workout?.full?.blocks ?? [])].map((b) => b.exercise_id))),
  ];
  const mealIds = [...new Set(plan.days.flatMap((d) => d.meals.flatMap((m) => [m.meal_idea_id, ...m.alternatives])))];
  const [ex, ml] = await Promise.all([
    exerciseIds.length
      ? supabase
          .from("exercises")
          .select("id, slug, name_he, equipment, primary_muscles, secondary_muscles, instructions_he, cautions_he, easier_slug")
          .in("id", exerciseIds)
      : Promise.resolve({ data: [], error: null }),
    mealIds.length
      ? supabase.from("meal_ideas").select("id, title_he, hint_he").in("id", mealIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ex.error) throw new Error(ex.error.message);
  if (ml.error) throw new Error(ml.error.message);
  return {
    plan,
    version: data.version,
    exercises: new Map((ex.data as ExerciseInfo[]).map((e) => [e.id, e])),
    meals: new Map((ml.data as MealInfo[]).map((m) => [m.id, m])),
  };
}

export type TaskStatus = "pending" | "done" | "partial" | "swapped" | "skipped";

export interface DayTask {
  id: string;
  type: TaskType;
  title: string;
  points: number;
  status: TaskStatus;
  earned: number;
}

/** Tasks of one day from the active plan, with the points already earned. */
export async function loadDayTasks(userId: string, date: string): Promise<{ hasPlan: boolean; tasks: DayTask[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_tasks")
    .select("id, type, title, points, status, sort_order, plans!inner(status), task_completions(points_awarded)")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("plans.status", "active")
    .order("sort_order");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    id: string;
    type: TaskType;
    title: string;
    points: number;
    status: TaskStatus;
    task_completions: { points_awarded: number } | { points_awarded: number }[] | null;
  }[];
  const tasks = rows.map((r) => {
    const c = Array.isArray(r.task_completions) ? r.task_completions[0] : r.task_completions;
    return { id: r.id, type: r.type, title: r.title, points: r.points, status: r.status, earned: c?.points_awarded ?? 0 };
  });
  return { hasPlan: tasks.length > 0, tasks };
}
