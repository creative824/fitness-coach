import type { FoodTotals } from "@/lib/food/items";

/** A range total, always labelled as an estimate. */
export function FoodTotalsLine({ totals, label }: { totals: FoodTotals; label: string }) {
  if (!totals.kcal && totals.protein === null) return null;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-coral-soft px-4 py-3 text-sm">
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-medium">{label}:</span>
        {totals.kcal ? (
          <span>
            הערכה של <span className="num" dir="ltr">{`${totals.kcal[0]}–${totals.kcal[1]}`}</span> קל׳
          </span>
        ) : (
          <span className="text-ink-muted">אין עדיין הערכת קלוריות</span>
        )}
      </span>
      {totals.protein !== null || totals.carbs !== null || totals.fat !== null ? (
        <span className="text-xs text-ink-muted">
          בערך: חלבון <span className="num">{totals.protein ?? "–"}</span> ג׳ · פחמימות <span className="num">{totals.carbs ?? "–"}</span> ג׳ · שומן{" "}
          <span className="num">{totals.fat ?? "–"}</span> ג׳
        </span>
      ) : null}
      {totals.missing ? <span className="text-xs text-ink-muted">{totals.missing} פריטים בלי הערכה לא נכללו.</span> : null}
    </div>
  );
}
