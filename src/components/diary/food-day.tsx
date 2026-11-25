"use client";

import { Beef, Check, ChevronLeft, Lightbulb, Plus, Send, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { confirmFoodLog } from "@/lib/food/actions";
import { clockOf, foodsLine, kcalMid, orderMeals, summarize, titleOf, type DiaryMeal } from "@/lib/food/diary";
import { totalsOf, type MealType } from "@/lib/food/items";
import type { RecentMeal } from "@/lib/food/recent";
import { AddMealSheet } from "./add-meal-sheet";
import { EditMealSheet } from "./edit-meal-sheet";
import { IdeaSheet, type IdeaContext } from "./idea-sheet";

const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");

export interface FoodDayProps {
  dateLabel: string;
  isToday: boolean;
  meals: (DiaryMeal & { source?: "web" | "telegram" })[];
  target: number | null;
  proteinTarget: number | null;
  showNumbers: boolean;
  defaultMeal: MealType;
  recent: RecentMeal[];
  ideaContext: Omit<IdeaContext, "eatenKcal" | "eatenProtein">;
  savedIdeas: string[];
  photoEnabled: boolean;
}

/**
 * "יום האוכל שלי": what was eaten and what is left at a glance, the day's meals in order, and the
 * two things that matter: add a meal (+) and get a meal idea. Everything else is a tap away.
 */
export function FoodDay(p: FoodDayProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [ideas, setIdeas] = useState(false);
  const [editing, setEditing] = useState<DiaryMeal | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const meals = useMemo(() => orderMeals(p.meals), [p.meals]);
  const sum = useMemo(() => summarize(p.meals, p.target, p.proteinTarget, { finished: !p.isToday }), [p.meals, p.target, p.proteinTarget, p.isToday]);
  const ideaContext = useMemo(() => ({ ...p.ideaContext, eatenKcal: sum.kcal, eatenProtein: sum.protein }), [p.ideaContext, sum.kcal, sum.protein]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const done = (msg: string) => {
    setAdding(false);
    setEditing(null);
    setToast(msg);
    router.refresh();
  };

  return (
    <>
      <Header {...p} sum={sum} />

      {p.isToday ? (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-14 flex-[1.4] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-white shadow-[0_10px_24px_-12px_rgba(18,21,19,0.7)] hover:bg-brand-strong active:scale-[0.98]"
          >
            <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
            הוספת ארוחה
          </button>
          <button
            type="button"
            onClick={() => setIdeas(true)}
            className="inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-surface px-3 font-medium leading-tight shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] hover:bg-field active:scale-[0.98]"
          >
            <Lightbulb aria-hidden="true" className="size-5 shrink-0 text-warning" />
            תן לי רעיון לארוחה
          </button>
        </div>
      ) : null}

      <section aria-label="הארוחות של היום" className="flex flex-col gap-2.5" aria-busy={pending}>
        {meals.map((m) => {
          const t = totalsOf(m.items);
          const kcal = m.items.reduce((a, i) => a + kcalMid(i), 0);
          const line = foodsLine(m.items) || m.text;
          return (
            <article key={m.id} className="relative">
              <button
                type="button"
                onClick={() => setEditing(m)}
                className="flex w-full cursor-pointer flex-col gap-1.5 rounded-[var(--radius-card)] bg-surface p-4 text-start shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] transition-colors hover:bg-white active:scale-[0.99]"
                aria-label={`${titleOf(m.mealType, m.loggedAt)} ${clockOf(m.loggedAt)}, לעריכה`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{titleOf(m.mealType, m.loggedAt)}</span>
                    <span className="num text-sm text-ink-muted">{clockOf(m.loggedAt)}</span>
                    {m.source === "telegram" ? <Send aria-label="מטלגרם" className="size-3.5 text-ink-muted" /> : null}
                    {m.status === "draft" ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">ממתין לאישור</span> : null}
                  </span>
                  <ChevronLeft aria-hidden="true" className="size-4 text-ink-faint" />
                </span>
                <span className="leading-snug">{line}</span>
                {p.showNumbers && m.items.some((i) => i.kcal_min !== null) ? (
                  <span className="text-sm text-ink-muted">
                    <span className="num font-semibold text-ink">{fmt(kcal)}</span> קלוריות
                    {t.protein ? (
                      <>
                        {" | "}
                        <span className="num font-semibold text-ink">{t.protein}</span> גרם חלבון
                      </>
                    ) : null}
                  </span>
                ) : null}
              </button>
              {m.status === "draft" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await confirmFoodLog(m.id);
                      router.refresh();
                    })
                  }
                  className="absolute end-12 top-3 inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg bg-accent-soft px-2.5 text-sm font-medium hover:brightness-95"
                >
                  <Check aria-hidden="true" className="size-4" />
                  אישור
                </button>
              ) : null}
            </article>
          );
        })}

        {p.isToday ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line text-ink-muted hover:border-ink/20 hover:text-ink"
          >
            <Plus aria-hidden="true" className="size-5" />
            {meals.length ? "הוספת ארוחה נוספת" : "הוספת הארוחה הראשונה של היום"}
          </button>
        ) : !meals.length ? (
          <p className="rounded-[var(--radius-card)] bg-surface p-4 text-ink-muted">לא נרשם אוכל ביום הזה.</p>
        ) : null}
      </section>

      {sum.meals ? <Summary sum={sum} showNumbers={p.showNumbers} isToday={p.isToday} /> : null}

      {adding ? (
        <AddMealSheet
          open
          onClose={() => setAdding(false)}
          onAdded={(m) => done(p.showNumbers && m.kcal ? `נוסף ליומן: ${fmt(m.kcal)} קלוריות, ${fmt(m.protein)} גרם חלבון.` : "נוסף ליומן.")}
          defaultMeal={p.defaultMeal}
          recent={p.recent}
          showNumbers={p.showNumbers}
          photoEnabled={p.photoEnabled}
        />
      ) : null}
      {editing ? <EditMealSheet key={editing.id} meal={editing} onClose={() => setEditing(null)} onDone={done} showNumbers={p.showNumbers} /> : null}
      <IdeaSheet open={ideas} onClose={() => setIdeas(false)} onEaten={done} context={ideaContext} saved={p.savedIdeas} showNumbers={p.showNumbers} />

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

function Header({ dateLabel, target, proteinTarget, showNumbers, sum }: FoodDayProps & { sum: ReturnType<typeof summarize> }) {
  const share = target ? Math.min(1, sum.kcal / target) : 0;
  const over = target !== null && sum.kcal > target;
  const left = target !== null ? target - sum.kcal : null;
  return (
    <section aria-label="יום האוכל שלי" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-night p-4 text-white shadow-[var(--shadow-float)]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">יום האוכל שלי</h2>
        <span className="text-sm text-white/60">{dateLabel}</span>
      </div>
      {showNumbers ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <p className="flex flex-col">
              <span className="text-xs text-white/60">נאכלו</span>
              <span>
                <span className="num text-5xl leading-none font-bold">{fmt(sum.kcal)}</span>
                {target ? <span className="num text-base text-white/60"> / {fmt(target)}</span> : null}
              </span>
            </p>
            {left !== null ? (
              <p className="flex flex-col items-end text-end">
                <span className="text-xs text-white/60">{over ? "מעל היעד" : "נותרו"}</span>
                <span className={`num text-3xl leading-none font-bold ${over ? "text-coral" : "text-accent"}`}>{fmt(Math.abs(left))}</span>
              </p>
            ) : null}
          </div>
          {target ? (
            <div
              className="h-3 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="קלוריות מהיעד"
              aria-valuenow={Math.round(share * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-coral" : "bg-accent"}`} style={{ width: `${share * 100}%` }} />
            </div>
          ) : null}
          <p className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Beef aria-hidden="true" className="size-4 text-white/60" />
              חלבון: <span className="num font-semibold">{fmt(sum.protein)}</span>
              {proteinTarget ? <span className="num text-white/60">/ {proteinTarget} גרם</span> : <span className="text-white/60">גרם</span>}
            </span>
            {proteinTarget ? (
              <span className="h-2 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <span className="block h-full rounded-full bg-sky" style={{ width: `${Math.min(100, (sum.protein / proteinTarget) * 100)}%` }} />
              </span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="text-white/80">
          {sum.meals ? (
            <>
              נרשמו היום <span className="num font-semibold">{sum.meals}</span> ארוחות.
            </>
          ) : (
            "עוד לא נרשמו ארוחות היום."
          )}
        </p>
      )}
    </section>
  );
}

function Summary({ sum, showNumbers, isToday }: { sum: ReturnType<typeof summarize>; showNumbers: boolean; isToday: boolean }) {
  const met = sum.calorieGoal === "on" && sum.proteinGoal !== false;
  return (
    <section aria-labelledby="sum-title" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <h2 id="sum-title" className="flex items-center gap-1.5 font-semibold">
        {met ? <Trophy aria-hidden="true" className="size-4 text-accent-strong" /> : null}
        {isToday ? "סיכום היום עד עכשיו" : "סיכום היום"}
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
        <Stat label="ארוחות שתועדו" value={String(sum.meals)} />
        {showNumbers ? (
          <>
            <Stat label="קלוריות" value={sum.target ? `${fmt(sum.kcal)} / ${fmt(sum.target)}` : fmt(sum.kcal)} />
            <Stat label="חלבון" value={sum.proteinTarget ? `${fmt(sum.protein)} / ${sum.proteinTarget} ג׳` : `${fmt(sum.protein)} ג׳`} />
            {sum.left !== null ? <Stat label={sum.left >= 0 ? "נשאר מהיעד" : "מעל היעד"} value={`${fmt(Math.abs(sum.left))} קל׳`} /> : null}
            {sum.richest ? <Stat label="הכי עשירה בחלבון" value={`${sum.richest.title} (${sum.richest.protein} ג׳)`} wide /> : null}
            {sum.calorieGoal && (!isToday || sum.calorieGoal === "on" || sum.proteinGoal) ? (
              <Stat
                label="יעדים"
                wide
                value={`${sum.calorieGoal === "on" ? "✓ קלוריות בטווח" : sum.calorieGoal === "over" ? "קלוריות מעל היעד" : isToday ? "קלוריות: עוד לא" : "קלוריות מתחת ליעד"}${sum.proteinGoal === null ? "" : sum.proteinGoal ? " · ✓ חלבון" : " · חלבון: עוד לא"}`}
              />
            ) : null}
          </>
        ) : null}
      </dl>
      {showNumbers && sum.insight ? <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">{sum.insight}</p> : null}
    </section>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="num font-semibold">{value}</dd>
    </div>
  );
}
