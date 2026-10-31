import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewButtons } from "@/components/admin/review-buttons";
import { StatusBadge } from "@/components/admin/status-badge";
import { parseStatus, StatusFilter } from "@/components/admin/status-filter";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { listMealIdeas } from "@/lib/admin/content";
import { requireAdmin } from "@/lib/admin/guard";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const m = t.admin.meal;
const allergenName = t.screens.onboarding.options.allergies as Record<string, string>;
const name = <T extends Record<string, string>>(dict: T, key: string) => dict[key as keyof T] ?? key;

export const metadata: Metadata = { title: t.admin.nav.meals, robots: { index: false } };

export default function MealIdeasAdminPage({ searchParams }: PageProps<"/admin/meals">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <MealIdeaList searchParams={searchParams} />
    </Suspense>
  );
}

async function MealIdeaList({ searchParams }: { searchParams: PageProps<"/admin/meals">["searchParams"] }) {
  await requireAdmin();
  const status = parseStatus((await searchParams).status);
  const rows = await listMealIdeas(status);
  return (
    <>
      <StatusFilter base="/admin/meals" current={status} />
      <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">{m.note}</p>
      {rows.length === 0 ? (
        <EmptyState title={t.admin.empty} body={t.admin.reviewNote} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((x) => (
            <li key={x.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{x.title_he}</h2>
                  <StatusBadge status={x.review_status} />
                </div>
                {x.hint_he ? <p className="text-ink-muted">{x.hint_he}</p> : null}
                <p className="text-sm">
                  {x.meal_type.map((k) => name(m.mealTypes, k)).join(", ")} · {name(m.portions, x.portion)}
                  {" · "}
                  <span className="font-medium">{m.components}:</span> {x.components.map((k) => name(m.componentNames, k)).join(", ")}
                </p>
                <p className="text-sm">
                  <span className="font-medium">{m.allergens}:</span>{" "}
                  {x.allergens.length ? x.allergens.map((a) => allergenName[a] ?? a).join(", ") : m.noAllergens}
                  {" · "}
                  <span className="font-medium">{m.diet}:</span> {x.dietary_tags.map((d) => name(m.diets, d)).join(", ")}
                </p>
                <ReviewButtons table="meal_ideas" id={x.id} status={x.review_status} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
