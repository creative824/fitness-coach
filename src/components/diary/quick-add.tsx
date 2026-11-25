"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { MealType } from "@/lib/food/items";
import type { RecentMeal } from "@/lib/food/recent";
import { AddMealSheet } from "./add-meal-sheet";

const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");

/**
 * The big + on the home screen: write what you ate, approve, and the day's numbers (calories,
 * protein, the daily score) update at once. The same sheet as in the food diary.
 */
export function QuickAddMeal({
  defaultMeal,
  recent,
  showNumbers,
  photoEnabled,
}: {
  defaultMeal: MealType;
  recent: RecentMeal[];
  showNumbers: boolean;
  photoEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="הוספת ארוחה"
        className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+4.75rem)] left-4 z-30 flex size-16 cursor-pointer items-center justify-center rounded-full bg-accent text-ink shadow-[var(--shadow-lime),var(--shadow-float)] ring-4 ring-canvas transition-transform active:scale-95 md:bottom-8 md:left-8"
      >
        <Plus aria-hidden="true" className="size-8" strokeWidth={2.5} />
      </button>
      {open ? (
        <AddMealSheet
          open
          onClose={() => setOpen(false)}
          onAdded={(m) => {
            setOpen(false);
            setToast(showNumbers && m.kcal ? `נוסף ליומן: ${fmt(m.kcal)} קלוריות, ${fmt(m.protein)} גרם חלבון.` : "נוסף ליומן.");
            router.refresh();
          }}
          defaultMeal={defaultMeal}
          recent={recent}
          showNumbers={showNumbers}
          photoEnabled={photoEnabled}
        />
      ) : null}
      {toast ? (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5rem)] z-40 mx-auto max-w-md rounded-2xl bg-night px-4 py-3 text-center text-white shadow-[var(--shadow-float)] md:bottom-8"
        >
          {toast}
        </p>
      ) : null}
    </>
  );
}
