/**
 * Step 4 of the plan engine (docs/TECH_PLAN.md): filter the approved libraries down to what a
 * given user may receive. Pure code, no AI. Anything filtered out here can never reach the plan.
 */
import type { SafetyResult } from "@/lib/safety/screen";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface ExerciseCandidate {
  id: string;
  slug: string;
  name_he: string;
  category: "strength" | "cardio" | "mobility" | "core";
  mode: "reps" | "seconds";
  difficulty: Difficulty;
  equipment: string[];
  primary_muscles: string[];
  contraindications: string[];
}

export interface MealCandidate {
  id: string;
  slug: string;
  title_he: string;
  hint_he: string | null;
  meal_type: string[];
  portion: "light" | "regular";
  dietary_tags: string[];
  allergens: string[];
}

export interface FitnessFilter {
  experience: Difficulty | null;
  location: string[];
  equipment: string[];
  limitations: string;
  safety: SafetyResult;
}

export interface FoodFilter {
  dietaryPattern: string | null;
  allergies: string[];
  dislikes: string[];
}

/** Everything a gym is assumed to have. */
const GYM_EQUIPMENT = ["mat", "dumbbells", "kettlebell", "bands", "pullup_bar", "bench", "machines", "barbell"];

/** Equipment the user can use. A floor (mat) is assumed everywhere. */
export function availableEquipment(f: Pick<FitnessFilter, "location" | "equipment">): Set<string> {
  const set = new Set<string>(["none", "mat", ...f.equipment]);
  if (f.location.includes("gym")) for (const e of GYM_EQUIPMENT) set.add(e);
  return set;
}

/** Free-text limitations mapped to the exercise contraindication tags. */
const LIMITATION_WORDS: [RegExp, string][] = [
  // Hebrew has no \b: a whole word, optionally with a one-letter prefix (ב, ה, ו, ל), so that
  // "גבוה" (high) or "ברכה" (blessing) do not count as a back or knee problem.
  [/(^|[^א-ת])[בהול]?(ברך|ברכיים|ברכי)([^א-ת]|$)|מניסקוס|רצועה צולבת|knee/i, "knee"],
  [/כתף|כתפי|shoulder/i, "shoulder"],
  [/(^|[^א-ת])[בהול]?(גב|גבי)([^א-ת]|$)|דיסק|back/i, "lower_back"],
  [/שורש כף|פרק כף|שורש היד|מפרק היד|wrist/i, "wrist"],
  [/צוואר|neck/i, "neck"],
];

export function blockedTags(f: Pick<FitnessFilter, "limitations" | "safety">): Set<string> {
  const tags = new Set<string>();
  for (const [re, tag] of LIMITATION_WORDS) if (re.test(f.limitations)) tags.add(tag);
  const { reasons, restrictions } = f.safety;
  if (restrictions.lowIntensityOnly) tags.add("high_impact");
  if (reasons.includes("pregnancy")) {
    tags.add("high_impact");
    tags.add("supine");
  }
  return tags;
}

const RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export function maxDifficulty(f: Pick<FitnessFilter, "experience" | "safety">): Difficulty {
  if (f.safety.restrictions.lowIntensityOnly) return "beginner";
  return f.experience ?? "beginner";
}

export function filterExercises(all: ExerciseCandidate[], f: FitnessFilter): ExerciseCandidate[] {
  if (f.safety.restrictions.noWorkouts) return [];
  const gear = availableEquipment(f);
  const blocked = blockedTags(f);
  const top = RANK[maxDifficulty(f)];
  return all.filter(
    (e) =>
      RANK[e.difficulty] <= top &&
      e.equipment.every((x) => gear.has(x)) &&
      !e.contraindications.some((c) => blocked.has(c)),
  );
}

/** Which dietary tag a pattern requires. Omnivore, kosher (any kosher tag) and "other" are handled below. */
const PATTERN_TAG: Record<string, string> = { vegetarian: "vegetarian", vegan: "vegan", pescatarian: "pescatarian" };

export function filterMeals(all: MealCandidate[], f: FoodFilter): MealCandidate[] {
  const allergies = new Set(f.allergies);
  const dislikes = f.dislikes.map((d) => d.trim()).filter((d) => d.length >= 2);
  const need = f.dietaryPattern ? PATTERN_TAG[f.dietaryPattern] : undefined;
  return all.filter(
    (m) =>
      !m.allergens.some((a) => allergies.has(a)) &&
      (!need || m.dietary_tags.includes(need)) &&
      (f.dietaryPattern !== "kosher" || m.dietary_tags.some((t) => t.startsWith("kosher_"))) &&
      !dislikes.some((d) => m.title_he.includes(d) || (m.hint_he ?? "").includes(d)),
  );
}
