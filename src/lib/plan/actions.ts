"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { generateWeekPlan, type GenerateResult } from "./data";
import { weekStartOf } from "./week";

/** Creates (or recreates) the plan of the current week. */
export async function createWeekPlan(): Promise<GenerateResult> {
  const user = await requireUser();
  const result = await generateWeekPlan(user.id, weekStartOf(localDay(new Date()).date));
  if (result.ok) {
    revalidatePath("/today");
    revalidatePath("/plan");
  }
  return result;
}

const outcome = z.enum(["pending", "done", "partial", "swapped", "skipped"]);

/**
 * Marks a task. The today screen updates on the spot (client state), so this action does not
 * re-render the page: one database call, nothing else.
 */
export async function setTaskOutcome(taskId: string, value: string): Promise<{ ok: boolean }> {
  const parsed = outcome.safeParse(value);
  if (!parsed.success || !z.uuid().safeParse(taskId).success) return { ok: false };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_task_outcome", { p_task_id: taskId, p_outcome: parsed.data });
  if (error) console.error("set_task_outcome failed", error.message);
  return { ok: !error };
}
