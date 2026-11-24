import "server-only";
import { createClient } from "@/lib/supabase/server";
import { savedFoodOf, type SavedFood } from "./saved";

/** The user's saved recipes and regular foods, the most recent first. Empty before 0012 runs. */
export async function loadSavedFoods(userId: string): Promise<SavedFood[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_foods")
    .select("id, name, kind, unit_name, yield_units, per_unit, recipe, accuracy")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []).flatMap((r) => {
    const f = savedFoodOf(r as Record<string, unknown>);
    return f ? [f] : [];
  });
}
