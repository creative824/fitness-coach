"use server";

import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";

const weight = z.number().min(30).max(350);

/** Saves today's weight (one entry per day; a second entry the same day replaces it). */
export async function logWeight(kg: number): Promise<{ ok: boolean; date?: string }> {
  const parsed = weight.safeParse(Math.round(kg * 10) / 10);
  if (!parsed.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const date = localDay(new Date()).date;
  const { error } = await supabase
    .from("weight_logs")
    .upsert({ user_id: user.id, date, weight_kg: parsed.data }, { onConflict: "user_id,date" });
  if (error) console.error("logWeight failed", error.message);
  return error ? { ok: false } : { ok: true, date };
}
