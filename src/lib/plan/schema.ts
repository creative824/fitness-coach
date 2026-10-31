/**
 * Weekly plan contract (spec §7). The AI must return JSON matching this schema.
 *
 * Key rule: the AI picks and arranges; it does not invent. Meals reference `recipe_id`
 * and workouts reference `exercise_id` from the approved libraries. Numbers that matter
 * for safety (calorie range, water target, points) are computed in code, not by the model.
 * A plan that fails schema or consistency checks is sent back for repair and never shown.
 */
import { z } from "zod";

const isoDate = z.iso.date();
const uuid = z.uuid();
const shortText = z.string().min(1).max(280);

export const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const; // 0 = Sunday

export const mealSchema = z.object({
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  recipe_id: uuid,
  servings: z.number().positive().max(4),
  alternatives: z.array(uuid).max(3).default([]),
});

export const exerciseBlockSchema = z
  .object({
    exercise_id: uuid,
    sets: z.int().min(1).max(8),
    reps: z.int().min(1).max(50).optional(),
    seconds: z.int().min(5).max(600).optional(),
    rest_seconds: z.int().min(0).max(300),
    note: shortText.optional(),
  })
  .refine((b) => (b.reps === undefined) !== (b.seconds === undefined), {
    message: "Each block uses either reps or seconds, not both.",
  });

export const workoutSchema = z.object({
  title: shortText,
  location: z.enum(["home", "gym", "outdoors"]),
  estimated_minutes: z.int().min(5).max(120),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  blocks: z.array(exerciseBlockSchema).min(1).max(12),
  why: shortText, // what this workout trains, in plain words
});

export const habitSchema = z.object({
  type: z.enum(["movement", "water", "recovery", "habit"]),
  title: shortText,
  target: shortText.optional(), // e.g. "20 דקות הליכה"
});

export const daySchema = z.object({
  date: isoDate,
  is_rest_day: z.boolean(),
  meals: z.array(mealSchema).max(6),
  workout: workoutSchema.nullable(),
  habits: z.array(habitSchema).max(5),
});

export const weeklyPlanSchema = z.object({
  schema_version: z.literal(1),
  week_start: isoDate,
  summary: z.object({
    focus: shortText, // the goal of the week
    principles: z.array(shortText).max(5),
    assumptions: z.array(shortText).max(5), // what the plan assumed about the user
  }),
  targets: z.object({
    // Filled from code (src/lib/plan/targets.ts, phase 3), copied here for display.
    calories_range: z.tuple([z.int(), z.int()]).nullable(), // null when not appropriate (e.g. safety flag)
    water_ml: z.int().min(0).max(5000),
    workouts_per_week: z.int().min(0).max(7),
  }),
  days: z.array(daySchema).length(7),
  explanation: z.string().min(1).max(1200), // why these actions were chosen
});

export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;
export type PlanDay = z.infer<typeof daySchema>;
