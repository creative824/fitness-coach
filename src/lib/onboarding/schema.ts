/**
 * Onboarding questionnaire data (spec §6). One shape for the whole form; each step validates
 * only its own fields so partial drafts can be autosaved.
 */
import { z } from "zod";

export const GOAL_TYPES = [
  "lose_weight",
  "maintain_weight",
  "gain_weight",
  "strength",
  "muscle",
  "endurance",
  "general_fitness",
  "flexibility",
  "habits",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const ALLERGENS = ["gluten", "milk", "egg", "peanut", "tree_nut", "soy", "fish", "shellfish", "sesame"] as const;
export const DIETARY_PATTERNS = ["omnivore", "vegetarian", "vegan", "pescatarian", "kosher", "other"] as const;
export const EXPERIENCE = ["beginner", "intermediate", "advanced"] as const;
export const LOCATIONS = ["home", "gym", "outdoors"] as const;
export const EQUIPMENT = ["none", "mat", "dumbbells", "kettlebell", "bands", "pullup_bar", "bench", "machines", "barbell"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export const DAYS = [0, 1, 2, 3, 4, 5, 6] as const; // 0 = Sunday

export const SAFETY_QUESTIONS = [
  "medical_condition",
  "pregnancy",
  "active_injury",
  "chest_pain",
  "fainting",
  "eating_disorder",
  "medical_restriction",
] as const;
export type SafetyQuestion = (typeof SAFETY_QUESTIONS)[number];

const day = z.int().min(0).max(6);
const shortList = z.array(z.string().trim().min(1).max(40)).max(20);
const yesNo = z.boolean().nullable(); // null = not answered yet

export const MIN_AGE = 18;

export const stepSchemas = {
  details: z.object({
    display_name: z.string().trim().min(1).max(40),
    age: z.int().min(MIN_AGE).max(100),
    height_cm: z.number().min(120).max(230),
    weight_kg: z.number().min(35).max(300),
    target_weight_kg: z.number().min(35).max(300).nullable(),
  }),
  goals: z.object({
    goals: z.array(z.enum(GOAL_TYPES)).min(1).max(3),
  }),
  nutrition: z.object({
    dietary_pattern: z.enum(DIETARY_PATTERNS),
    allergies: z.array(z.enum(ALLERGENS)),
    sensitivities: shortList,
    likes: shortList,
    dislikes: shortList,
    meals_per_day: z.int().min(1).max(6),
    cooking_minutes: z.int().min(0).max(120),
  }),
  fitness: z.object({
    experience: z.enum(EXPERIENCE),
    location: z.array(z.enum(LOCATIONS)).min(1),
    equipment: z.array(z.enum(EQUIPMENT)),
    available_days: z.array(day).min(1).max(7),
    session_minutes: z.int().min(10).max(120),
  }),
  safety: z.object({
    limitations: z.string().trim().max(500),
    answers: z.object(Object.fromEntries(SAFETY_QUESTIONS.map((q) => [q, z.boolean()])) as Record<SafetyQuestion, z.ZodBoolean>),
  }),
  lifestyle: z.object({
    activity_level: z.enum(ACTIVITY_LEVELS),
    sleep_hours: z.number().min(3).max(14),
    water_cups_now: z.int().min(0).max(20),
    busy_days: z.array(day).max(7),
  }),
} as const;

export const STEP_ORDER = ["details", "goals", "nutrition", "fitness", "safety", "lifestyle"] as const;
export type StepKey = (typeof STEP_ORDER)[number];

/** Draft shape: everything optional/nullable so a half-filled form can be saved. */
export interface OnboardingDraft {
  display_name: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  goals: GoalType[];
  dietary_pattern: (typeof DIETARY_PATTERNS)[number] | null;
  allergies: (typeof ALLERGENS)[number][];
  sensitivities: string[];
  likes: string[];
  dislikes: string[];
  meals_per_day: number | null;
  cooking_minutes: number | null;
  experience: (typeof EXPERIENCE)[number] | null;
  location: (typeof LOCATIONS)[number][];
  equipment: (typeof EQUIPMENT)[number][];
  available_days: number[];
  session_minutes: number | null;
  limitations: string;
  answers: Record<SafetyQuestion, boolean | null>;
  activity_level: (typeof ACTIVITY_LEVELS)[number] | null;
  sleep_hours: number | null;
  water_cups_now: number | null;
  busy_days: number[];
}

export const emptyDraft = (): OnboardingDraft => ({
  display_name: "",
  age: null,
  height_cm: null,
  weight_kg: null,
  target_weight_kg: null,
  goals: [],
  dietary_pattern: null,
  allergies: [],
  sensitivities: [],
  likes: [],
  dislikes: [],
  meals_per_day: 3,
  cooking_minutes: 20,
  experience: null,
  location: [],
  equipment: [],
  available_days: [],
  session_minutes: 30,
  limitations: "",
  answers: Object.fromEntries(SAFETY_QUESTIONS.map((q) => [q, null])) as Record<SafetyQuestion, boolean | null>,
  activity_level: null,
  sleep_hours: 7,
  water_cups_now: null,
  busy_days: [],
});

/** Loose schema for autosave: accepts any partial draft but still bounds every value. */
export const draftSchema = z.object({
  display_name: z.string().trim().max(40),
  age: z.int().min(0).max(120).nullable(),
  height_cm: z.number().min(50).max(260).nullable(),
  weight_kg: z.number().min(20).max(400).nullable(),
  target_weight_kg: z.number().min(20).max(400).nullable(),
  goals: z.array(z.enum(GOAL_TYPES)).max(3),
  dietary_pattern: z.enum(DIETARY_PATTERNS).nullable(),
  allergies: z.array(z.enum(ALLERGENS)),
  sensitivities: shortList,
  likes: shortList,
  dislikes: shortList,
  meals_per_day: z.int().min(1).max(8).nullable(),
  cooking_minutes: z.int().min(0).max(240).nullable(),
  experience: z.enum(EXPERIENCE).nullable(),
  location: z.array(z.enum(LOCATIONS)),
  equipment: z.array(z.enum(EQUIPMENT)),
  available_days: z.array(day).max(7),
  session_minutes: z.int().min(5).max(180).nullable(),
  limitations: z.string().max(500),
  answers: z.object(Object.fromEntries(SAFETY_QUESTIONS.map((q) => [q, yesNo])) as Record<SafetyQuestion, typeof yesNo>),
  activity_level: z.enum(ACTIVITY_LEVELS).nullable(),
  sleep_hours: z.number().min(0).max(24).nullable(),
  water_cups_now: z.int().min(0).max(40).nullable(),
  busy_days: z.array(day).max(7),
});

/** Returns the first incomplete step, or null when every step is valid. */
export function firstIncompleteStep(draft: OnboardingDraft): StepKey | null {
  for (const key of STEP_ORDER) {
    if (!stepSchemas[key].safeParse(draft).success) return key;
  }
  return null;
}

export function stepErrors(step: StepKey, draft: OnboardingDraft): string[] {
  const r = stepSchemas[step].safeParse(draft);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => String(i.path[0])))];
}
