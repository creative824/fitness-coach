"use server";

import { revalidatePath } from "next/cache";
import { avatarSchema, type AvatarConfig } from "@/lib/avatar";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";

/** Saves the illustrated face to the profile (kept with the other preferences). */
export async function saveAvatar(input: AvatarConfig): Promise<{ ok: boolean }> {
  const parsed = avatarSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase.from("profiles").select("preferences").eq("user_id", user.id).maybeSingle();
  const preferences = { ...((row?.preferences as Record<string, unknown> | null) ?? {}), avatar: parsed.data };
  const { error } = await supabase.from("profiles").update({ preferences }).eq("user_id", user.id);
  if (error) {
    console.error("saveAvatar failed", error.message);
    return { ok: false };
  }
  revalidatePath("/profile");
  revalidatePath("/today");
  return { ok: true };
}
