"use server";

import { z } from "zod";
import { syncHabitTask, syncMovementTask, syncWorkoutTask } from "@/lib/day/tasks";
import { requireUser } from "@/lib/data/user";
import { loadDayLog, type FitnessState } from "@/lib/menu/data";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { loadOnboarding } from "@/lib/onboarding/data";
import { loadWorkoutPool } from "@/lib/workout/data";
import type { ExerciseResult, Summary } from "@/lib/workout/session";
import { MAX_ITEMS, storedWorkoutOf, type StoredSession } from "@/lib/workout/today";
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

const smartInput = z.object({ id: z.string().regex(/^[a-z_]{2,20}$/), done: z.boolean(), type: z.enum(["movement", "recovery", "habit"]) });

/** Marks one of the day's smart tasks done or not; a done task also completes the plan task of its kind. */
export async function setSmartTaskDone(id: string, done: boolean, type: "movement" | "recovery" | "habit"): Promise<FitnessResult> {
  const p = smartInput.safeParse({ id, done, type });
  if (!p.success) return { ok: false };
  const key = `t:${p.data.id}`;
  return withFitness(
    (f) => ({ ...f, done: p.data.done ? [...new Set([...f.done, key])] : f.done.filter((k) => k !== key) }),
    async (_f, userId, date) => {
      await syncHabitTask(await createClient(), userId, date, p.data.type, p.data.done);
    },
  );
}

const durationSchema = z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.null()]);

/**
 * Saves today's workout as edited on the home screen (a new length, swaps, sets/reps/rest,
 * exercises added or removed). Only exercises from the user's own pool are accepted. A changed
 * exercise keeps its tick only if it stayed as it was (`keep`).
 */
export async function saveTodayWorkout(minutes: number | null, items: unknown[], keep: number[] = []): Promise<FitnessResult> {
  const len = durationSchema.safeParse(minutes);
  const kept = z.array(z.int().min(0).max(MAX_ITEMS - 1)).max(MAX_ITEMS).safeParse(keep);
  if (!kept.success) return { ok: false };
  const keepKeys = new Set(kept.data.map((k) => `ex:${k}`));
  const workout = storedWorkoutOf({ minutes, items });
  if (!len.success || !workout || workout.items.length !== items.length) return { ok: false };
  const user = await requireUser();
  const { draft } = await loadOnboarding(user.id);
  const { pool } = await loadWorkoutPool(draft);
  const allowed = new Set(pool.map((e) => e.slug));
  if (!workout.items.every((i) => allowed.has(i.slug))) return { ok: false };
  return withFitness(
    (f) => ({ ...f, workout, done: f.done.filter((k) => !k.startsWith("ex:") || keepKeys.has(k)) }),
    async (f, userId, date) => {
      const count = f.done.filter((k) => k.startsWith("ex:") && Number(k.slice(3)) < workout.items.length).length;
      await syncWorkoutTask(await createClient(), userId, date, count, workout.items.length);
    },
  );
}

const resultSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  sets: z.int().min(0).max(6),
  reps: z.int().min(0).max(300),
  seconds: z.int().min(0).max(7200),
  hold: z.int().min(0).max(300),
  skipped: z.boolean(),
});
const finishSchema = z.object({
  from: z.int().min(0).max(MAX_ITEMS - 1),
  total: z.int().min(1).max(MAX_ITEMS),
  results: z.array(resultSchema).min(1).max(MAX_ITEMS),
  summary: z.object({ exercises: z.int().min(1).max(MAX_ITEMS), done: z.int().min(0).max(MAX_ITEMS), sets: z.int().min(0).max(60), reps: z.int().min(0).max(3000), minutes: z.int().min(1).max(300) }),
});

/**
 * "סיימתי אימון": the only step that counts a guided workout. The exercises done are marked
 * (so the fitness score and the plan's workout task follow), the session is kept with the day,
 * and each exercise goes into the workout history (exercise_logs).
 */
export async function finishWorkout(input: { from: number; total: number; results: ExerciseResult[]; summary: Summary }): Promise<FitnessResult> {
  const p = finishSchema.safeParse(input);
  if (!p.success || p.data.from + p.data.results.length > p.data.total) return { ok: false };
  const { from, total, results, summary } = p.data;
  const keys = results.flatMap((r, k) => (!r.skipped && r.sets > 0 ? [`ex:${from + k}`] : []));
  const session: StoredSession = { at: new Date().toISOString(), ...summary };
  return withFitness(
    (f) => ({ ...f, done: [...new Set([...f.done, ...keys])], sessions: [...(f.sessions ?? []), session].slice(-5) }),
    async (f, userId, date) => {
      const supabase = await createClient();
      const count = f.done.filter((k) => k.startsWith("ex:") && Number(k.slice(3)) < total).length;
      await syncWorkoutTask(supabase, userId, date, count, total);
      const done = results.filter((r) => r.sets > 0);
      if (!done.length) return;
      const { data } = await supabase.from("exercises").select("id, slug").in("slug", done.map((r) => r.slug));
      const ids = new Map((data ?? []).map((e) => [e.slug as string, e.id as string]));
      const rows = done.map((r) => {
        const per = r.reps ? Math.round(r.reps / r.sets) : 0;
        const secs = r.hold;
        return {
          user_id: userId,
          exercise_id: ids.get(r.slug) ?? null,
          date,
          sets: Array.from({ length: r.sets }, () => (secs ? { seconds: secs } : { reps: per })),
          notes: r.skipped ? "אימון מודרך (דולג באמצע)" : "אימון מודרך",
        };
      });
      const { error } = await supabase.from("exercise_logs").insert(rows);
      if (error) console.error("exercise log failed", error.message);
    },
  );
}
