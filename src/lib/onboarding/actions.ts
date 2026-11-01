"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/user";
import { generateWeekPlan } from "@/lib/plan/data";
import { weekStartOf } from "@/lib/plan/week";
import { createClient } from "@/lib/supabase/server";
import { localDay } from "@/lib/water/time";
import { draftToRows } from "./mapping";
import { draftSchema, firstIncompleteStep, STEP_ORDER, type OnboardingDraft } from "./schema";

export type SaveResult = { ok: true } | { ok: false; error: string };

async function persist(draft: OnboardingDraft, step: number, complete: boolean): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const rows = draftToRows(user.id, parsed.data as OnboardingDraft, step, new Date());
  const supabase = await createClient();

  const profile = complete ? { ...rows.profile, onboarding_completed_at: new Date().toISOString() } : rows.profile;
  const results = await Promise.all([
    supabase.from("profiles").upsert(profile),
    supabase.from("food_preferences").upsert(rows.food),
    supabase.from("exercise_preferences").upsert(rows.exercise),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: "db" };

  // Replace the active goal set (at most three rows).
  const del = await supabase.from("goals").delete().eq("user_id", user.id).eq("active", true);
  if (del.error) return { ok: false, error: "db" };
  if (rows.goals.length) {
    const ins = await supabase.from("goals").insert(rows.goals);
    if (ins.error) return { ok: false, error: "db" };
  }
  return { ok: true };
}

/** Autosave: called on every change (debounced) and when moving between steps. */
export async function saveOnboardingDraft(draft: OnboardingDraft, step: number): Promise<SaveResult> {
  const clamped = Math.max(0, Math.min(step, STEP_ORDER.length));
  return persist(draft, clamped, false);
}

/** Final confirmation from the summary screen. Every step must be valid. */
export async function completeOnboarding(draft: OnboardingDraft): Promise<SaveResult> {
  if (firstIncompleteStep(draft) !== null) return { ok: false, error: "incomplete" };
  const r = await persist(draft, STEP_ORDER.length, true);
  if (!r.ok) return r;
  // Create this week's plan right away. If it cannot be made yet (e.g. the libraries are not
  // approved), the today screen offers a button instead.
  const user = await requireUser();
  await generateWeekPlan(user.id, weekStartOf(localDay(new Date()).date)).catch(() => null);
  redirect("/today");
}
