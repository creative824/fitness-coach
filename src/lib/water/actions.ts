"use server";

import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { VESSEL_SIZES_ML } from "./plan";
import { localDay } from "./time";

/*
 * Water taps must feel instant. The card keeps its own state and updates on the tap; these
 * actions only write to the database (one or two parallel calls) and never re-render the page.
 */

const vessel = z.number().refine((v) => (VESSEL_SIZES_ML as readonly number[]).includes(v));
const taskId = z.uuid().nullable();

type Result = { ok: boolean };

/** Keeps the day's water task in step with the target: done once reached, open again if undone. */
function syncWaterTask(supabase: Awaited<ReturnType<typeof createClient>>, id: string | null, reached: boolean | null) {
  if (!id || reached === null) return Promise.resolve({ error: null });
  return supabase.rpc("set_task_outcome", { p_task_id: id, p_outcome: reached ? "done" : "pending" });
}

/** One tap = one finished glass or bottle of the given size. */
export async function addWaterFill(vesselMl: number, waterTaskId: string | null, reached: boolean | null): Promise<Result> {
  if (!vessel.safeParse(vesselMl).success || !taskId.safeParse(waterTaskId).success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const [ins, sync] = await Promise.all([
    supabase.from("water_logs").insert({ user_id: user.id, date: localDay(new Date()).date, amount_ml: vesselMl }),
    syncWaterTask(supabase, waterTaskId, reached),
  ]);
  if (ins.error || sync.error) console.error("addWaterFill failed", ins.error?.message ?? sync.error?.message);
  return { ok: !ins.error };
}

/** Removes today's most recent fill (a mistaken tap). */
export async function undoWaterFill(waterTaskId: string | null, reached: boolean | null): Promise<Result> {
  if (!taskId.safeParse(waterTaskId).success) return { ok: false };
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
  if (error) return { ok: false };
  const [del, sync] = await Promise.all([
    data ? supabase.from("water_logs").delete().eq("id", data.id) : Promise.resolve({ error: null }),
    syncWaterTask(supabase, waterTaskId, reached),
  ]);
  return { ok: !del.error && !sync.error };
}

export async function setWaterVessel(vesselMl: number): Promise<Result> {
  if (!vessel.safeParse(vesselMl).success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ water_vessel_ml: vesselMl }).eq("user_id", user.id);
  return { ok: !error };
}
