import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ReviewStatus = "draft" | "approved" | "retired";
export const REVIEW_STATUSES: ReviewStatus[] = ["draft", "approved", "retired"];

export interface ExerciseRow {
  id: string;
  slug: string;
  name_he: string;
  instructions_he: string;
  cautions_he: string | null;
  equipment: string[];
  difficulty: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  contraindications: string[];
  category: string;
  mode: string;
  easier_slug: string | null;
  review_status: ReviewStatus;
  reviewed_at: string | null;
}

export interface RecipeRow {
  id: string;
  slug: string;
  name_he: string;
  meal_type: string[];
  dietary_tags: string[];
  allergens: string[];
  ingredients: { name_he: string; amount: number; unit: string; optional?: boolean }[];
  steps_he: string[];
  prep_minutes: number | null;
  servings: number;
  nutrition: Record<string, number> | null;
  nutrition_source: string | null;
  review_status: ReviewStatus;
  reviewed_at: string | null;
}

export async function listExercises(status?: ReviewStatus): Promise<ExerciseRow[]> {
  const supabase = await createClient();
  let q = supabase.from("exercises").select("*").order("category").order("name_he");
  if (status) q = q.eq("review_status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as ExerciseRow[];
}

export async function getExercise(id: string): Promise<ExerciseRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ExerciseRow | null;
}

export async function listRecipes(status?: ReviewStatus): Promise<RecipeRow[]> {
  const supabase = await createClient();
  let q = supabase.from("recipes").select("*").order("name_he");
  if (status) q = q.eq("review_status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as RecipeRow[];
}

export async function getRecipe(id: string): Promise<RecipeRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as RecipeRow | null;
}

export async function contentCounts() {
  const supabase = await createClient();
  const count = async (table: "exercises" | "recipes", status: ReviewStatus) => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("review_status", status);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const [ed, ea, rd, ra] = await Promise.all([
    count("exercises", "draft"),
    count("exercises", "approved"),
    count("recipes", "draft"),
    count("recipes", "approved"),
  ]);
  return { exercises: { draft: ed, approved: ea }, recipes: { draft: rd, approved: ra } };
}
