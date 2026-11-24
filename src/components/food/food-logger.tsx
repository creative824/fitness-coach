"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { saveFoodLog } from "@/lib/food/actions";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/food/items";
import type { SavedFood } from "@/lib/food/saved";
import { FoodEntry, useFoodEntry } from "./food-entry";

/**
 * "What did you eat": free text, counted live from the food database as you type (amounts can
 * be nudged with − / +), saved to the day in one tap.
 */
export function FoodLogger({ aiEnabled, tracking, defaultMeal, savedFoods = [] }: { aiEnabled: boolean; tracking: boolean; defaultMeal: MealType; savedFoods?: SavedFood[] }) {
  const router = useRouter();
  const entry = useFoodEntry(savedFoods);
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [note, setNote] = useState<string | null>(null);
  // Made on the first save attempt and kept for retries, so a repeated tap is not stored twice.
  const clientRef = useRef<string | null>(null);
  const [saving, startSave] = useTransition();

  function save() {
    setNote(null);
    clientRef.current ??= crypto.randomUUID();
    const ref = clientRef.current;
    const kcal = entry.kcal;
    startSave(async () => {
      const r = await saveFoodLog({ text: entry.text, mealType: meal, status: "confirmed", clientRef: ref, estimated: entry.items.length > 0, items: entry.items });
      if (!r.ok) {
        setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
        return;
      }
      entry.reset();
      clientRef.current = null;
      setNote(tracking && kcal ? `נשמר: ${kcal} קל׳ נוספו להיום.` : "נשמר.");
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">מה אכלת?</h2>
      <FoodEntry entry={entry} aiEnabled={aiEnabled} showNumbers={tracking} />
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">איזו ארוחה</legend>
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            aria-pressed={meal === m}
            className={`min-h-9 cursor-pointer rounded-full px-3 text-sm transition-colors ${meal === m ? "bg-brand text-white" : "bg-field hover:bg-line/60"}`}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </fieldset>
      <button
        type="button"
        onClick={save}
        disabled={saving || entry.text.trim().length < 2}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
        {tracking && entry.kcal ? (
          <>
            שמירה · <span className="num">{entry.kcal}</span> קל׳
          </>
        ) : (
          "שמירה"
        )}
      </button>
      {note ? (
        <p role="status" className="rounded-xl bg-field px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
    </Card>
  );
}
