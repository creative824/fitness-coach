"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { estimateMeal, type EstimateResult } from "./estimate";
import { DAILY_ESTIMATE_LIMIT } from "./limits";
import { saveFoodSchema } from "./items";

const text = z.string().trim().min(2).max(1000);

/** AI estimate of a meal's items. Nothing is saved until the user confirms or keeps a draft. */
export async function analyzeFood(input: string): Promise<EstimateResult> {
  const parsed = text.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "failed" };
  await requireUser();
  const supabase = await createClient();
  const { data: allowed, error } = await supabase.rpc("take_ai_quota", { p_kind: "food_estimate", p_limit: DAILY_ESTIMATE_LIMIT });
  // Fails open if the quota check itself errors (e.g. migration not applied yet), so logging still works.
  if (error) console.error("take_ai_quota failed", error.message);
  else if (allowed === false) return { ok: false, reason: "limit" };
  return estimateMeal(parsed.data);
}

export async function saveFoodLog(input: z.input<typeof saveFoodSchema>): Promise<{ ok: boolean; id?: string }> {
  const parsed = saveFoodSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("calorie_tracking").eq("user_id", user.id).maybeSingle();
  const tracking = profile?.calorie_tracking !== false;
  const d = parsed.data;
  // With calorie tracking off, only what was eaten is kept, without numbers.
  const items = d.items.map((i) =>
    tracking ? i : { ...i, kcal_min: null, kcal_max: null, protein_g: null, carbs_g: null, fat_g: null, confidence: null },
  );
  const { data, error } = await supabase.rpc("save_food_log", {
    p_date: localDay(new Date()).date,
    p_meal_type: d.mealType,
    p_text: d.text,
    p_status: d.status,
    p_source: "web",
    p_client_ref: d.clientRef,
    p_estimated: d.estimated && tracking,
    p_items: items,
  });
  if (error) {
    console.error("saveFoodLog failed", error.message);
    return { ok: false };
  }
  revalidatePath("/food");
  return { ok: true, id: data as string };
}

const id = z.uuid();

export async function confirmFoodLog(logId: string): Promise<{ ok: boolean }> {
  if (!id.safeParse(logId).success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("food_logs")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", logId)
    .eq("user_id", user.id);
  revalidatePath("/food");
  return { ok: !error };
}

export async function deleteFoodLog(logId: string): Promise<{ ok: boolean }> {
  if (!id.safeParse(logId).success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("food_logs").delete().eq("id", logId).eq("user_id", user.id);
  revalidatePath("/food");
  return { ok: !error };
}

export async function setCalorieTracking(on: boolean): Promise<{ ok: boolean }> {
  if (typeof on !== "boolean") return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ calorie_tracking: on }).eq("user_id", user.id);
  revalidatePath("/food");
  revalidatePath("/profile");
  return { ok: !error };
}
