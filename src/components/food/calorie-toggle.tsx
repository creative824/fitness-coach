"use client";

import { useOptimistic, useTransition } from "react";
import { setCalorieTracking } from "@/lib/food/actions";

/** Calorie tracking on or off. Off keeps the meal log, without any numbers. */
export function CalorieToggle({ on }: { on: boolean }) {
  const [value, setValue] = useOptimistic(on);
  const [, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="font-medium">מעקב קלוריות</span>
        <span className="text-sm text-ink-muted">
          {value ? "מוצגות הערכות של קלוריות וערכים תזונתיים." : "היומן שומר רק מה אכלת, בלי מספרים."}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setValue(next);
            await setCalorieTracking(next);
          });
        }}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-ink ${value ? "bg-brand" : "bg-line"}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${value ? "start-6" : "start-1"}`} />
      </span>
    </label>
  );
}
