"use client";

import { Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { itemLabel, kcalMid, nextFactor, portionNote, scaleItem } from "@/lib/food/diary";
import { totalsOf, type FoodItem } from "@/lib/food/items";

const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");

/**
 * The foods of one meal as understood, with a factor per food so an amount can be changed
 * (− / +) or a food removed, and the totals worked out again on every change.
 */
export function useMealItems(initial: FoodItem[]) {
  const [base, setBase] = useState(initial);
  const [factors, setFactors] = useState<number[]>(() => initial.map(() => 1));
  const items = useMemo(() => base.map((b, i) => (factors[i] === 1 ? b : scaleItem(b, factors[i]))), [base, factors]);
  const totals = useMemo(() => totalsOf(items), [items]);
  return {
    base,
    factors,
    items,
    kcal: items.reduce((a, i) => a + kcalMid(i), 0),
    protein: totals.protein ?? 0,
    carbs: totals.carbs ?? 0,
    fat: totals.fat ?? 0,
    nudge(i: number, dir: 1 | -1) {
      const next = nextFactor(base[i], factors[i], dir);
      if (next !== null) setFactors((f) => f.map((x, k) => (k === i ? next : x)));
    },
    remove(i: number) {
      setBase((b) => b.filter((_, k) => k !== i));
      setFactors((f) => f.filter((_, k) => k !== i));
    },
    add(list: FoodItem[]) {
      setBase((b) => [...b, ...list]);
      setFactors((f) => [...f, ...list.map(() => 1)]);
    },
    reset(list: FoodItem[]) {
      setBase(list);
      setFactors(list.map(() => 1));
    },
  };
}
export type MealItems = ReturnType<typeof useMealItems>;

/** "2 ביצים ……… 150 קל׳", optionally with − / + and remove on each line. */
export function ItemRows({ meal, editable, showNumbers }: { meal: MealItems; editable: boolean; showNumbers: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-ink/5">
      {meal.items.map((it, i) => {
        const note = portionNote(meal.base[i], meal.factors[i]);
        return (
          <li key={i} className="flex min-h-11 items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1 leading-snug">
              {itemLabel(it)}
              {note ? <span className="text-sm text-ink-muted"> · {note}</span> : null}
            </span>
            {editable ? (
              <span className="flex shrink-0 items-center gap-0.5">
                <Step label={`פחות ${it.item_name}`} onClick={() => meal.nudge(i, -1)} Icon={Minus} />
                <Step label={`יותר ${it.item_name}`} onClick={() => meal.nudge(i, 1)} Icon={Plus} />
              </span>
            ) : null}
            {showNumbers ? (
              <span className="shrink-0 text-end text-sm">
                <span className="num font-semibold">{it.kcal_min === null ? "–" : fmt(kcalMid(it))}</span>
                <span className="text-ink-muted"> קל׳</span>
              </span>
            ) : null}
            {editable ? (
              <button
                type="button"
                onClick={() => meal.remove(i)}
                aria-label={`הסרת ${it.item_name}`}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-field hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Step({ label, onClick, Icon }: { label: string; onClick: () => void; Icon: typeof Plus }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-field text-ink hover:bg-line/70"
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}

/** Total calories in large type, protein beside it, carbs and fat small. */
export function MealTotals({ meal }: { meal: Pick<MealItems, "kcal" | "protein" | "carbs" | "fat"> }) {
  return (
    <div className="flex flex-col gap-1 border-t border-ink/10 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">סה״כ</span>
        <span>
          <span className="num text-3xl font-bold">{fmt(meal.kcal)}</span> <span className="text-sm">קלוריות</span>
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          חלבון: <span className="num font-semibold">{fmt(meal.protein)}</span> גרם
        </span>
        <span className="text-ink-muted">
          פחמימות <span className="num">{fmt(meal.carbs)}</span> · שומן <span className="num">{fmt(meal.fat)}</span> ג׳
        </span>
      </div>
    </div>
  );
}
