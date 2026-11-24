"use server";

import { z } from "zod";
import { requireUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";

const pts = z.int().min(0).max(70).nullable();
const input = z.object({
  score: z.int().min(0).max(100),
  points: z.object({ calories: pts, protein: pts, fitness: pts, tasks: pts }),
  kcalTarget: z.int().min(0).max(10000).nullable(),
  proteinTarget: z.int().min(0).max(1000).nullable(),
});

/** Saves today's score, so past days keep the score they had. Quietly does nothing before 0011. */
export async function saveDayScore(raw: z.infer<typeof input>): Promise<{ ok: boolean }> {
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false };
  const user = await requireUser();
  const date = localDay(new Date()).date;
  const supabase = await createClient();
  const { error } = await supabase.from("day_logs").update({ score: p.data }).eq("user_id", user.id).eq("date", date);
  return { ok: !error };
}
