import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewButtons } from "@/components/admin/review-buttons";
import { StatusBadge } from "@/components/admin/status-badge";
import { parseStatus, StatusFilter } from "@/components/admin/status-filter";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { listRecipes } from "@/lib/admin/content";
import { requireAdmin } from "@/lib/admin/guard";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const r = t.admin.recipe;
const allergenName = t.screens.onboarding.options.allergies as Record<string, string>;

export const metadata: Metadata = { title: t.admin.nav.recipes, robots: { index: false } };

export default function RecipesAdminPage({ searchParams }: PageProps<"/admin/recipes">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <RecipeList searchParams={searchParams} />
    </Suspense>
  );
}

async function RecipeList({ searchParams }: { searchParams: PageProps<"/admin/recipes">["searchParams"] }) {
  await requireAdmin();
  const status = parseStatus((await searchParams).status);
  const rows = await listRecipes(status);
  return (
    <>
      <StatusFilter base="/admin/recipes" current={status} />
      <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">{r.nutritionMissing}</p>
      {rows.length === 0 ? (
        <EmptyState title={t.admin.empty} body={t.admin.reviewNote} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((x) => (
            <li key={x.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{x.name_he}</h2>
                  <StatusBadge status={x.review_status} />
                </div>
                <p className="text-sm text-ink-muted">
                  {x.meal_type.map((m) => r.mealTypes[m as keyof typeof r.mealTypes] ?? m).join(", ")} · {x.prep_minutes} {r.prep} ·{" "}
                  {x.servings} {r.servings}
                </p>
                <p className="text-sm">
                  <span className="font-medium">{r.allergens}:</span>{" "}
                  {x.allergens.length ? x.allergens.map((a) => allergenName[a] ?? a).join(", ") : r.noAllergens}
                  {" · "}
                  <span className="font-medium">{r.diet}:</span> {x.dietary_tags.map((d) => r.diets[d as keyof typeof r.diets] ?? d).join(", ")}
                </p>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-brand">{r.ingredients}</summary>
                  <ul className="mt-2 list-disc ps-5">
                    {x.ingredients.map((i) => (
                      <li key={i.name_he}>
                        {i.name_he} · <span className="ltr-nums">{i.amount}</span> {r.units[i.unit as keyof typeof r.units] ?? i.unit}
                        {i.optional ? ` ${t.screens.onboarding.optional}` : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 font-medium">{r.steps}</p>
                  <ol className="list-decimal ps-5">
                    {x.steps_he.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </details>
                <ReviewButtons table="recipes" id={x.id} status={x.review_status} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
