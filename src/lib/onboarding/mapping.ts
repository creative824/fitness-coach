/**
 * Pure mapping between the onboarding draft and the database rows (profiles, goals,
 * food_preferences, exercise_preferences). Kept free of I/O so it can be unit tested.
 */
import { screenSafety, type SafetyResult } from "@/lib/safety/screen";
import { emptyDraft, SAFETY_QUESTIONS, type OnboardingDraft, type SafetyQuestion } from "./schema";

export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: string | null;
  sleep_hours: number | null;
  water_cups_now: number | null;
  busy_days: number[];
  /** Small optional answers that have no column of their own. */
  preferences?: { sex?: string | null };
  safety_flags: { answers?: Partial<Record<SafetyQuestion, boolean | null>>; result?: SafetyResult; evaluated_at?: string };
  onboarding_step: number;
  onboarding_completed_at?: string | null;
}

export interface FoodRow {
  user_id: string;
  dietary_pattern: string | null;
  allergies: string[];
  sensitivities: string[];
  likes: string[];
  dislikes: string[];
  meals_per_day: number | null;
  cooking_minutes: number | null;
}

export interface ExerciseRow {
  user_id: string;
  experience: string | null;
  location: string[];
  equipment: string[];
  available_days: number[];
  session_minutes: number | null;
  limitations: string | null;
}

export interface GoalRow {
  user_id: string;
  goal_type: string;
  priority: number;
  active: boolean;
}

export function ageToBirthYear(age: number | null, now: Date): number | null {
  return age === null ? null : now.getFullYear() - age;
}

export function birthYearToAge(birthYear: number | null, now: Date): number | null {
  return birthYear === null ? null : now.getFullYear() - birthYear;
}

export function draftToRows(userId: string, d: OnboardingDraft, step: number, now: Date) {
  const safety = screenSafety(d);
  const profile: ProfileRow = {
    user_id: userId,
    display_name: d.display_name || null,
    birth_year: ageToBirthYear(d.age, now),
    height_cm: d.height_cm,
    weight_kg: d.weight_kg,
    target_weight_kg: d.target_weight_kg,
    activity_level: d.activity_level,
    sleep_hours: d.sleep_hours,
    water_cups_now: d.water_cups_now,
    busy_days: d.busy_days,
    preferences: { sex: d.sex },
    safety_flags: { answers: d.answers, result: safety, evaluated_at: now.toISOString() },
    onboarding_step: step,
  };
  const food: FoodRow = {
    user_id: userId,
    dietary_pattern: d.dietary_pattern,
    allergies: d.allergies,
    sensitivities: d.sensitivities,
    likes: d.likes,
    dislikes: d.dislikes,
    meals_per_day: d.meals_per_day,
    cooking_minutes: d.cooking_minutes,
  };
  const exercise: ExerciseRow = {
    user_id: userId,
    experience: d.experience,
    location: d.location,
    equipment: d.equipment,
    available_days: d.available_days,
    session_minutes: d.session_minutes,
    limitations: d.limitations || null,
  };
  const goals: GoalRow[] = d.goals.map((g, i) => ({ user_id: userId, goal_type: g, priority: i + 1, active: true }));
  return { profile, food, exercise, goals, safety };
}

export function rowsToDraft(
  rows: {
    profile: Partial<ProfileRow> | null;
    food: Partial<FoodRow> | null;
    exercise: Partial<ExerciseRow> | null;
    goals: { goal_type: string; priority: number }[];
  },
  now: Date,
): OnboardingDraft {
  const d = emptyDraft();
  const p = rows.profile;
  if (p) {
    d.display_name = p.display_name ?? "";
    d.age = birthYearToAge(p.birth_year ?? null, now);
    d.height_cm = num(p.height_cm);
    d.weight_kg = num(p.weight_kg);
    d.target_weight_kg = num(p.target_weight_kg);
    d.activity_level = (p.activity_level as OnboardingDraft["activity_level"]) ?? null;
    d.sleep_hours = num(p.sleep_hours) ?? d.sleep_hours;
    d.water_cups_now = p.water_cups_now ?? null;
    d.busy_days = p.busy_days ?? [];
    const sex = p.preferences?.sex;
    d.sex = sex === "male" || sex === "female" ? sex : null;
    const answers = p.safety_flags?.answers ?? {};
    for (const q of SAFETY_QUESTIONS) d.answers[q] = answers[q] ?? null;
  }
  const f = rows.food;
  if (f) {
    d.dietary_pattern = (f.dietary_pattern as OnboardingDraft["dietary_pattern"]) ?? null;
    d.allergies = (f.allergies ?? []) as OnboardingDraft["allergies"];
    d.sensitivities = f.sensitivities ?? [];
    d.likes = f.likes ?? [];
    d.dislikes = f.dislikes ?? [];
    d.meals_per_day = f.meals_per_day ?? d.meals_per_day;
    d.cooking_minutes = f.cooking_minutes ?? d.cooking_minutes;
  }
  const e = rows.exercise;
  if (e) {
    d.experience = (e.experience as OnboardingDraft["experience"]) ?? null;
    d.location = (e.location ?? []) as OnboardingDraft["location"];
    d.equipment = (e.equipment ?? []) as OnboardingDraft["equipment"];
    d.available_days = e.available_days ?? [];
    d.session_minutes = e.session_minutes ?? d.session_minutes;
    d.limitations = e.limitations ?? "";
  }
  d.goals = [...rows.goals].sort((a, b) => a.priority - b.priority).map((g) => g.goal_type) as OnboardingDraft["goals"];
  return d;
}

/** Postgres numeric comes back as a string through PostgREST. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
