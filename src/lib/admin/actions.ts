"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MUSCLES } from "@/content/muscles";
import { EQUIPMENT } from "@/lib/onboarding/schema";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./guard";

const status = z.enum(["draft", "approved", "retired"]);
const uuid = z.uuid();

export async function setReviewStatus(table: "exercises" | "recipes", id: string, next: string) {
  const admin = await requireAdmin();
  const parsed = z.object({ table: z.enum(["exercises", "recipes"]), id: uuid, next: status }).parse({ table, id, next });
  const supabase = await createClient();
  const { error } = await supabase
    .from(parsed.table)
    .update({
      review_status: parsed.next,
      reviewed_by: parsed.next === "draft" ? null : admin.id,
      reviewed_at: parsed.next === "draft" ? null : new Date().toISOString(),
    })
    .eq("id", parsed.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/${parsed.table}`);
}

const muscleIds = MUSCLES.map((m) => m.id) as [string, ...string[]];
const contraTags = ["knee", "shoulder", "lower_back", "wrist", "neck", "high_impact", "supine"] as const;
const lines = (s: FormDataEntryValue | null) =>
  String(s ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const exerciseForm = z.object({
  name_he: z.string().trim().min(2).max(80),
  instructions_he: z.string().trim().min(10).max(2000),
  cautions_he: z.string().trim().max(500),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  category: z.enum(["strength", "cardio", "mobility", "core"]),
  mode: z.enum(["reps", "seconds"]),
  equipment: z.array(z.enum(EQUIPMENT)),
  primary_muscles: z.array(z.enum(muscleIds)).min(1),
  secondary_muscles: z.array(z.enum(muscleIds)),
  contraindications: z.array(z.enum(contraTags)),
});

export type ExerciseFormState = { error?: string } | undefined;

export async function updateExercise(id: string, _prev: ExerciseFormState, form: FormData): Promise<ExerciseFormState> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { error: "invalid id" };
  const parsed = exerciseForm.safeParse({
    name_he: form.get("name_he"),
    instructions_he: lines(form.get("instructions_he")).join("\n"),
    cautions_he: form.get("cautions_he") ?? "",
    difficulty: form.get("difficulty"),
    category: form.get("category"),
    mode: form.get("mode"),
    equipment: form.getAll("equipment"),
    primary_muscles: form.getAll("primary_muscles"),
    secondary_muscles: form.getAll("secondary_muscles"),
    contraindications: form.getAll("contraindications"),
  });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const d = parsed.data;
  const secondary = d.secondary_muscles.filter((m) => !d.primary_muscles.includes(m));

  const supabase = await createClient();
  // Any edit sends the exercise back to draft so a changed exercise is re-approved before use.
  const { error } = await supabase
    .from("exercises")
    .update({ ...d, secondary_muscles: secondary, review_status: "draft", reviewed_by: null, reviewed_at: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}
