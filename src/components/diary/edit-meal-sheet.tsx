"use client";

import { Check, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteMeal, updateMeal } from "@/lib/food/diary-actions";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/food/items";
import type { DiaryMeal } from "@/lib/food/diary";
import { ItemRows, MealTotals, useMealItems } from "./items";
import { Sheet } from "./sheet";

/** Tapping a meal card: change the meal, the amounts, remove a food, or delete the meal. */
/** Mounted per meal (keyed by its id). */
export function EditMealSheet({ meal, onClose, onDone, showNumbers }: { meal: DiaryMeal; onClose: () => void; onDone: (msg: string) => void; showNumbers: boolean }) {
  const [type, setType] = useState<MealType>(meal.mealType ?? "other");
  const items = useMealItems(meal.items);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = items.items.length
        ? await updateMeal({ id: meal.id, mealType: type, items: items.items }).catch(() => ({ ok: false }))
        : await deleteMeal(meal.id).catch(() => ({ ok: false }));
      if (r.ok) onDone(items.items.length ? "הארוחה עודכנה." : "הארוחה נמחקה.");
      else setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteMeal(meal.id).catch(() => ({ ok: false }));
      if (r.ok) onDone("הארוחה נמחקה.");
      else setNote("המחיקה לא הצליחה. נסו שוב בעוד רגע.");
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="עריכת ארוחה"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex min-h-13 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-lg font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {pending ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Check aria-hidden="true" className="size-5" />}
            שמירה
          </button>
          <button
            type="button"
            onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
            disabled={pending}
            className={`inline-flex min-h-13 cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-4 font-medium ${confirmDelete ? "bg-danger text-white" : "bg-surface text-danger ring-1 ring-line hover:bg-danger-soft"}`}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {confirmDelete ? "למחוק?" : "מחיקה"}
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink-muted">{meal.text}</p>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">איזו ארוחה</legend>
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setType(m)}
            aria-pressed={type === m}
            className={`min-h-10 cursor-pointer rounded-full px-3.5 text-sm font-medium transition-colors ${type === m ? "bg-brand text-white" : "bg-surface ring-1 ring-line hover:bg-field"}`}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
        {items.items.length ? <ItemRows meal={items} editable showNumbers={showNumbers} /> : <p className="py-2 text-ink-muted">אין פריטים. שמירה תמחק את הארוחה.</p>}
        {showNumbers && items.items.length ? <MealTotals meal={items} /> : null}
      </div>
      {note ? (
        <p role="status" className="rounded-xl bg-field px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
    </Sheet>
  );
}
