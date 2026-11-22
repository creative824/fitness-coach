"use server";

import { z } from "zod";
import { syncMovementTask, syncWorkoutTask } from "@/lib/day/tasks";
import { requireUser } from "@/lib/data/user";
import { loadDayLog, type FitnessState } from "@/lib/menu/data";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { ACTIVITY_KINDS } from "./activities";

export type FitnessResult = { ok: true; fitness: FitnessState } | { ok: false };

async function withFitness(change: (f: FitnessState) => FitnessState, after?: (f: FitnessState, userId: string, date: string) => Promise<void>): Promise<FitnessResult> {
  const user = await requireUser();
  const date = localDay(new Date()).date;
  const day = await loadDayLog(user.id, date);
  if (!day.saved) return { ok: false };
  const next = change(day.fitness);
  const supabase = await createClient();
  const { error } = await supabase.from("day_logs").update({ fitness: next }).eq("user_id", user.id).eq("date", date);
  if (error) {
    console.error("fitness save failed", error.message);
    return { ok: false };
  }
  await after?.(next, user.id, date);
  return { ok: true, fitness: next };
}

const exerciseInput = z.object({ block: z.int().min(0).max(20), done: z.boolean(), total: z.int().min(1).max(20) });

/** Marks one exercise of today's workout done or not, and keeps the workout task in step. */
export async function setExerciseDone(block: number, done: boolean, total: number): Promise<FitnessResult> {
  const p = exerciseInput.safeParse({ block, done, total });
  if (!p.success) return { ok: false };
  const key = `ex:${p.data.block}`;
  return withFitness(
    (f) => ({ ...f, done: p.data.done ? [...new Set([...f.done, key])] : f.done.filter((k) => k !== key) }),
    async (f, userId, date) => {
      const count = f.done.filter((k) => k.startsWith("ex:") && Number(k.slice(3)) < p.data.total).length;
      await syncWorkoutTask(await createClient(), userId, date, count, p.data.total);
    },
  );
}

const activityInput = z.object({ kind: z.enum(ACTIVITY_KINDS as [string, ...string[]]), min: z.int().min(1).max(300) });

export async function addActivity(kind: string, min: number): Promise<FitnessResult> {
  const p = activityInput.safeParse({ kind, min });
  if (!p.success) return { ok: false };
  return withFitness(
    (f) => ({ ...f, acts: [...f.acts, { id: crypto.randomUUID().slice(0, 8), kind: p.data.kind, min: p.data.min }].slice(-20) }),
    async (f, userId, date) => {
      if (p.data.min >= 10) await syncMovementTask(await createClient(), userId, date, true);
    },
  );
}

export async function removeActivity(id: string): Promise<FitnessResult> {
  if (typeof id !== "string" || id.length > 40) return { ok: false };
  return withFitness((f) => ({ ...f, acts: f.acts.filter((a) => a.id !== id) }));
}
