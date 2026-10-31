import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExerciseForm } from "@/components/admin/exercise-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { LoadingState } from "@/components/ui/states";
import { getExercise } from "@/lib/admin/content";
import { requireAdmin } from "@/lib/admin/guard";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.admin.edit, robots: { index: false } };

export default function EditExercisePage({ params }: PageProps<"/admin/exercises/[id]">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <EditExercise params={params} />
    </Suspense>
  );
}

async function EditExercise({ params }: { params: PageProps<"/admin/exercises/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const exercise = await getExercise(id);
  if (!exercise) notFound();
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{exercise.name_he}</h1>
        <StatusBadge status={exercise.review_status} />
      </div>
      <ExerciseForm exercise={exercise} />
    </>
  );
}
