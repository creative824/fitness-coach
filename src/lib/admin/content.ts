import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ReviewStatus = "draft" | "approved" | "retired";
export type ContentTable = "exercises" | "meal_ideas";
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

export interface MealIdeaRow {
  id: string;
  slug: string;
  title_he: string;
  hint_he: string | null;
  meal_type: string[];
  portion: "light" | "regular";
  components: string[];
  dietary_tags: string[];
  allergens: string[];
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

export async function listMealIdeas(status?: ReviewStatus): Promise<MealIdeaRow[]> {
  const supabase = await createClient();
  let q = supabase.from("meal_ideas").select("*").order("title_he");
  if (status) q = q.eq("review_status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as MealIdeaRow[];
}

export async function contentCounts() {
  const supabase = await createClient();
  const count = async (table: ContentTable, status: ReviewStatus) => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("review_status", status);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const [ed, ea, rd, ra] = await Promise.all([
    count("exercises", "draft"),
    count("exercises", "approved"),
    count("meal_ideas", "draft"),
    count("meal_ideas", "approved"),
  ]);
  return { exercises: { draft: ed, approved: ea }, meals: { draft: rd, approved: ra } };
}
