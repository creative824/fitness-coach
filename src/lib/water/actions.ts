"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { VESSEL_SIZES_ML } from "./plan";
import { localDay } from "./time";

const vessel = z.coerce.number().refine((v) => (VESSEL_SIZES_ML as readonly number[]).includes(v));

/** One tap = one finished glass or bottle of the user's current size. */
export async function addWaterFill() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("water_vessel_ml").eq("user_id", user.id).maybeSingle();
  const { error } = await supabase
    .from("water_logs")
    .insert({ user_id: user.id, date: localDay(new Date()).date, amount_ml: profile?.water_vessel_ml ?? 250 });
  if (error) throw new Error(error.message);
  revalidatePath("/today");
}

/** Removes today's most recent fill (a mistaken tap). */
export async function undoWaterFill() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("water_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", localDay(new Date()).date)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    const { error: de } = await supabase.from("water_logs").delete().eq("id", data.id);
    if (de) throw new Error(de.message);
  }
  revalidatePath("/today");
}

export async function setWaterVessel(form: FormData) {
  const user = await requireUser();
  const parsed = vessel.safeParse(form.get("vessel_ml"));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ water_vessel_ml: parsed.data }).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/today");
}
