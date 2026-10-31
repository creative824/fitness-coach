import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReviewButtons } from "@/components/admin/review-buttons";
import { StatusBadge } from "@/components/admin/status-badge";
import { parseStatus, StatusFilter } from "@/components/admin/status-filter";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { MUSCLES } from "@/content/muscles";
import { listExercises } from "@/lib/admin/content";
import { requireAdmin } from "@/lib/admin/guard";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const a = t.admin.exercise;
const muscleName = Object.fromEntries(MUSCLES.map((m) => [m.id, m.name_he]));
const equipName = t.screens.onboarding.options.equipment as Record<string, string>;

export const metadata: Metadata = { title: t.admin.nav.exercises, robots: { index: false } };

export default function ExercisesAdminPage({ searchParams }: PageProps<"/admin/exercises">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <ExerciseList searchParams={searchParams} />
    </Suspense>
  );
}

async function ExerciseList({ searchParams }: { searchParams: PageProps<"/admin/exercises">["searchParams"] }) {
  await requireAdmin();
  const status = parseStatus((await searchParams).status);
  const rows = await listExercises(status);
  return (
    <>
      <StatusFilter base="/admin/exercises" current={status} />
      {rows.length === 0 ? (
        <EmptyState title={t.admin.empty} body={t.admin.reviewNote} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((e) => (
            <li key={e.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{e.name_he}</h2>
                  <StatusBadge status={e.review_status} />
                </div>
                <p className="text-sm text-ink-muted">
                  {a.categories[e.category as keyof typeof a.categories]} ·{" "}
                  {t.screens.onboarding.options.experience[e.difficulty as keyof typeof t.screens.onboarding.options.experience]} ·{" "}
                  {e.equipment.length ? e.equipment.map((q) => equipName[q] ?? q).join(", ") : equipName.none}
                </p>
                <p className="text-sm">
                  <span className="font-medium">{a.primary}:</span> {e.primary_muscles.map((m) => muscleName[m] ?? m).join(", ")}
                  {e.secondary_muscles.length ? (
                    <>
                      {" "}
                      · <span className="font-medium">{a.secondary}:</span> {e.secondary_muscles.map((m) => muscleName[m] ?? m).join(", ")}
                    </>
                  ) : null}
                </p>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-brand">{a.instructions.split(" (")[0]}</summary>
                  <ol className="mt-2 list-decimal ps-5">
                    {e.instructions_he.split("\n").map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ol>
                  {e.cautions_he ? <p className="mt-2 text-warning">{e.cautions_he}</p> : null}
                  {e.contraindications.length ? (
                    <p className="mt-2 text-ink-muted">
                      {a.contraindications}: {e.contraindications.map((c) => a.contras[c as keyof typeof a.contras] ?? c).join(", ")}
                    </p>
                  ) : null}
                </details>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ReviewButtons table="exercises" id={e.id} status={e.review_status} />
                  <Link href={`/admin/exercises/${e.id}`} className="text-sm font-medium text-brand underline">
                    {t.admin.edit}
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
