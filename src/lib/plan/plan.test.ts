import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/content/exercises";
import { MEAL_IDEAS } from "@/content/meal-ideas";
import { screenSafety } from "@/lib/safety/screen";
import { blockedTags, filterExercises, filterMeals, type ExerciseCandidate, type MealCandidate } from "./candidates";
import { composeWeek, mealSlots, pickWorkoutDays, type ComposeInput } from "./generate";
import { fitBlocks, REP_SECONDS, toMinutes, totalSeconds, warmupSeconds } from "./duration";
import { planToTasks, pointsFor } from "./tasks";
import { caloriesRange, computeTargets, type TargetInput } from "./targets";
import { validatePlan } from "./validate";
import { addDays, weekStartOf } from "./week";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const allExercises: ExerciseCandidate[] = EXERCISES.map((e, i) => ({
  id: uuid(i + 1),
  slug: e.slug,
  name_he: e.name_he,
  category: e.category,
  mode: e.mode,
  difficulty: e.difficulty,
  equipment: e.equipment,
  primary_muscles: e.primary,
  contraindications: e.contraindications,
}));
const allMeals: MealCandidate[] = MEAL_IDEAS.map((m, i) => ({
  id: uuid(1000 + i),
  slug: m.slug,
  title_he: m.title_he,
  hint_he: m.hint_he ?? null,
  meal_type: m.meal_type,
  portion: m.portion,
  dietary_tags: m.diet,
  allergens: m.allergens,
}));

const clear = screenSafety({ answers: {}, goals: ["general_fitness"], height_cm: 175, weight_kg: 75, target_weight_kg: null });
const refer = screenSafety({ answers: { chest_pain: true }, goals: ["general_fitness"], height_cm: 175, weight_kg: 75, target_weight_kg: null });
const pregnant = screenSafety({ answers: { pregnancy: true }, goals: ["general_fitness"], height_cm: 165, weight_kg: 65, target_weight_kg: null });

const targetBase: TargetInput = {
  age: 35,
  heightCm: 175,
  weightKg: 75,
  activityLevel: "light",
  goals: ["general_fitness"],
  experience: "beginner",
  availableDays: [0, 2, 4],
  safety: clear,
};

function input(over: Partial<ComposeInput> & { safety?: typeof clear } = {}): ComposeInput {
  const safety = over.safety ?? clear;
  const fitness = { experience: over.experience ?? ("beginner" as const), location: over.location ?? ["home"], equipment: [], limitations: "", safety };
  return {
    weekStart: "2026-11-01",
    goals: ["general_fitness"],
    targets: computeTargets({ ...targetBase, safety, experience: fitness.experience }),
    availableDays: [0, 2, 4],
    busyDays: [],
    sessionMinutes: 30,
    mealsPerDay: 3,
    allergies: [],
    exercises: filterExercises(allExercises, fitness),
    meals: allMeals,
    ...over,
    safety,
    experience: fitness.experience,
    location: fitness.location,
  };
}

describe("week", () => {
  it("starts on Sunday", () => {
    expect(weekStartOf("2026-11-04")).toBe("2026-11-01");
    expect(weekStartOf("2026-11-01")).toBe("2026-11-01");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("targets", () => {
  it("gives a calorie range, not a single number", () => {
    const [low, high] = caloriesRange(targetBase)!;
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThanOrEqual(1400);
  });
  it("gives no calorie range under a safety restriction", () => {
    expect(caloriesRange({ ...targetBase, safety: pregnant })).toBeNull();
  });
  it("gives no workouts on a referral", () => {
    expect(computeTargets({ ...targetBase, safety: refer }).workouts_per_week).toBe(0);
  });
});

describe("candidates", () => {
  it("drops meals with the user's allergens", () => {
    const out = filterMeals(allMeals, { dietaryPattern: null, allergies: ["gluten", "milk"], dislikes: [] });
    expect(out.length).toBeGreaterThan(5);
    expect(out.every((m) => !m.allergens.includes("gluten") && !m.allergens.includes("milk"))).toBe(true);
  });
  it("keeps only vegan meals for a vegan", () => {
    const out = filterMeals(allMeals, { dietaryPattern: "vegan", allergies: [], dislikes: [] });
    expect(out.every((m) => m.dietary_tags.includes("vegan"))).toBe(true);
  });
  it("maps knee pain to the knee tag but not 'גבוה' to back", () => {
    expect(blockedTags({ limitations: "כאב בברך שמאל", safety: clear }).has("knee")).toBe(true);
    expect(blockedTags({ limitations: "לחץ דם גבוה", safety: clear }).has("lower_back")).toBe(false);
    expect(blockedTags({ limitations: "כאבי גב", safety: clear }).has("lower_back")).toBe(true);
  });
  it("keeps only exercises the user has equipment for", () => {
    const out = filterExercises(allExercises, { experience: "advanced", location: ["home"], equipment: [], limitations: "", safety: clear });
    expect(out.every((e) => e.equipment.every((x) => x === "mat"))).toBe(true);
  });
  it("avoids high impact and lying on the back in pregnancy", () => {
    const out = filterExercises(allExercises, { experience: "advanced", location: ["gym"], equipment: [], limitations: "", safety: pregnant });
    expect(out.some((e) => e.contraindications.includes("supine") || e.contraindications.includes("high_impact"))).toBe(false);
    expect(out.every((e) => e.difficulty === "beginner")).toBe(true);
  });
});

describe("composeWeek", () => {
  it("builds a valid week that passes the consistency check", () => {
    const i = input();
    const plan = composeWeek(i);
    const v = validatePlan(plan, { weekStart: i.weekStart, exercises: i.exercises, meals: i.meals, allergies: [], safety: clear });
    expect(v).toEqual({ ok: true, plan });
    expect(plan.days.filter((d) => d.workout)).toHaveLength(3);
    expect(plan.days.every((d) => d.meals.length === 3)).toBe(true);
  });
  it("varies workouts through the week", () => {
    const plan = composeWeek(input());
    const firsts = plan.days.filter((d) => d.workout).map((d) => d.workout!.blocks.map((b) => b.exercise_id).join());
    expect(new Set(firsts).size).toBe(firsts.length);
  });
  it("has no workouts and a doctor note on a referral", () => {
    const i = input({ safety: refer, exercises: [] });
    const plan = composeWeek(i);
    expect(plan.days.some((d) => d.workout)).toBe(false);
    expect(plan.targets.calories_range).toBeNull();
    expect(validatePlan(plan, { ...i, allergies: [] }).ok).toBe(true);
  });
  it("is rejected by the validator when it contains an allergen", () => {
    const i = input();
    const plan = composeWeek(i);
    const glutenMeal = plan.days.flatMap((d) => d.meals).find((m) => allMeals.find((x) => x.id === m.meal_idea_id)!.allergens.includes("gluten"));
    expect(glutenMeal).toBeDefined();
    const v = validatePlan(plan, { weekStart: i.weekStart, exercises: i.exercises, meals: i.meals, allergies: ["gluten"], safety: clear });
    expect(v.ok).toBe(false);
  });
  it("rejects an exercise outside the candidates (no invention)", () => {
    const i = input();
    const plan = composeWeek(i);
    plan.days.find((d) => d.workout)!.workout!.blocks[0].exercise_id = uuid(9999);
    expect(validatePlan(plan, { ...i, allergies: [] }).ok).toBe(false);
  });
  it("prefers days that are not busy and spaces workouts", () => {
    expect(pickWorkoutDays(2, [0, 1, 2, 3], [1])).toEqual([0, 2]);
    expect(pickWorkoutDays(3, [0, 1, 2, 3, 4, 5], [])).toEqual([0, 2, 4]);
  });
  it("maps meals per day to slots", () => {
    expect(mealSlots(2)).toEqual(["breakfast", "dinner"]);
    expect(mealSlots(5)).toEqual(["breakfast", "lunch", "dinner", "snack", "snack"]);
  });
});

describe("workout length (follow-up spec §4)", () => {
  const levels = ["beginner", "intermediate", "advanced"] as const;
  it("never goes over the minutes the user has, warm-up and rests included", () => {
    for (const experience of levels) {
      for (const sessionMinutes of [5, 10, 12, 15, 20, 25, 30, 45, 60, 90]) {
        for (const location of [["home"], ["gym"]] as ("home" | "gym")[][]) {
          const i = input({ experience, sessionMinutes, location });
          const plan = composeWeek(i);
          for (const d of plan.days.filter((x) => x.workout)) {
            const w = d.workout!;
            const slugOf = (id: string) => i.exercises.find((e) => e.id === id)?.slug;
            const real = toMinutes(totalSeconds(w.blocks, warmupSeconds(sessionMinutes), slugOf));
            expect(w.estimated_minutes).toBe(real);
            expect(w.estimated_minutes).toBeLessThanOrEqual(sessionMinutes);
            expect(w.budget_minutes).toBe(sessionMinutes);
          }
          expect(validatePlan(plan, { ...i, allergies: [], sessionMinutes }).ok).toBe(true);
        }
      }
    }
  });
  it("gives a 10-minute user a workout of up to 10 minutes and keeps the longer one aside", () => {
    const plan = composeWeek(input({ sessionMinutes: 10, experience: "intermediate" }));
    const w = plan.days.find((d) => d.workout)!.workout!;
    expect(w.estimated_minutes).toBeLessThanOrEqual(10);
    expect(w.estimated_minutes).toBeGreaterThanOrEqual(6);
    expect(w.full?.estimated_minutes).toBeGreaterThan(10);
  });
  it("rejects a 17-minute workout for a user who has 10", () => {
    const i = input({ sessionMinutes: 10 });
    const plan = composeWeek(i);
    plan.days.find((d) => d.workout)!.workout!.estimated_minutes = 17;
    const v = validatePlan(plan, { ...i, allergies: [], sessionMinutes: 10 });
    expect(v.ok).toBe(false);
  });
  it("trims rests before sets and sets before exercises", () => {
    const blocks = [1, 2, 3].map((n) => ({ exercise_id: String(n), sets: 3, reps: 12, rest_seconds: 75 }));
    const fitted = fitBlocks(blocks, 10)!;
    expect(fitted).toHaveLength(3);
    expect(fitted.every((b) => b.rest_seconds === 30)).toBe(true);
    expect(totalSeconds(fitted, warmupSeconds(10))).toBeLessThanOrEqual(600);
  });
  it("counts both sides for one-sided exercises", () => {
    const b = { exercise_id: "x", sets: 2, reps: 10, rest_seconds: 60 };
    expect(totalSeconds([b], 0, () => "reverse-lunge")).toBe(totalSeconds([b], 0) + 2 * 10 * REP_SECONDS);
  });
});

describe("tasks", () => {
  it("creates a small set of tasks per day with stable order", () => {
    const plan = composeWeek(input());
    const titles = new Map(allMeals.map((m) => [m.id, m.title_he]));
    const tasks = planToTasks(plan, titles);
    const sunday = tasks.filter((t) => t.date === "2026-11-01");
    expect(sunday.map((t) => t.type)).toEqual(["meal", "meal", "meal", "workout", "water", "recovery"]);
    expect(new Set(tasks.map((t) => `${t.date}:${t.sort_order}`)).size).toBe(tasks.length);
  });
  it("gives half points for a partial outcome", () => {
    expect(pointsFor("workout", "done")).toBe(20);
    expect(pointsFor("meal", "partial")).toBe(3);
  });
});
