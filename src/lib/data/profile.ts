import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ProfileSummary {
  display_name: string | null;
  onboarding_completed_at: string | null;
}

export async function getProfileSummary(userId: string): Promise<ProfileSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
