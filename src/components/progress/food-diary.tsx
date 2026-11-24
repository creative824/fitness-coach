"use client";

import { Check, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { kcalOf } from "@/components/food/food-entry";
import type { FoodLog } from "@/lib/food/data";
import { confirmFoodLog, deleteFoodLog } from "@/lib/food/actions";
import { totalsOf } from "@/lib/food/items";
import { describeItem } from "@/lib/food/parse";

/** Sections of the day in order. Snacks before 15:00 sit between breakfast and lunch. */
const SECTIONS = [
  ["breakfast", "ארוחת בוקר"],
  ["midmorning", "ארוחת ביניים"],
  ["lunch", "ארוחת צהריים"],
  ["dinner", "ארוחת ערב"],
  ["snacks", "נשנושים"],
] as const;
type Section = (typeof SECTIONS)[number][0];

const hourIL = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Jerusalem" });

function sectionOf(l: FoodLog): Section {
  if (l.mealType === "breakfast" || l.mealType === "lunch" || l.mealType === "dinner") return l.mealType;
  if (l.mealType === "snack") return Number(hourIL.format(new Date(l.loggedAt))) < 15 ? "midmorning" : "snacks";
  const h = Number(hourIL.format(new Date(l.loggedAt)));
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snacks";
}

const mid = (r: [number, number] | null) => (r ? Math.round((r[0] + r[1]) / 2) : null);

/**
 * The food diary of one day, by meal: each food with its amount, calories and protein.
 * Adding opens the food log (today only); drafts can be confirmed and any entry removed.
 */
export function FoodDiary({ logs, tracking, canAdd }: { logs: FoodLog[]; tracking: boolean; canAdd: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const groups = SECTIONS.map(([key, label]) => ({ key, label, logs: logs.filter((l) => sectionOf(l) === key) }));
  const shown = canAdd ? groups.filter((g) => g.logs.length || g.key !== "midmorning") : groups.filter((g) => g.logs.length);

  return (
    <section aria-labelledby="diary-title" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <h2 id="diary-title" className="font-semibold">
          יומן אכילה
        </h2>
        {canAdd ? (
          <Link href="/food" className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong">
            <Plus aria-hidden="true" className="size-4" />
            הוספה
          </Link>
        ) : null}
      </div>
      {!shown.length ? <p className="text-sm text-ink-muted">לא נרשם אוכל ביום הזה.</p> : null}
      <ul className="flex flex-col divide-y divide-line" aria-busy={pending}>
        {shown.map((g) => {
          const t = totalsOf(g.logs.filter((l) => l.status === "confirmed").flatMap((l) => l.items));
          return (
            <li key={g.key} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{g.label}</h3>
                {tracking && t.kcal ? (
                  <span className="text-xs text-ink-muted">
                    <span className="num font-semibold text-ink">{mid(t.kcal)}</span> קל׳
                    {t.protein ? (
                      <>
                        {" · "}
                        <span className="num">{t.protein}</span> ג׳ חלבון
                      </>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {g.logs.length ? (
                g.logs.map((l) => (
                  <div key={l.id} className="flex flex-col gap-1 rounded-xl bg-field px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
                        {l.source === "telegram" ? <Send aria-label="מטלגרם" className="size-3.5" /> : null}
                        {l.status === "draft" ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">טיוטה</span> : null}
                        {l.items.length ? null : <span className="truncate">{l.text}</span>}
                      </span>
                      <span className="flex shrink-0 items-center">
                        {l.status === "draft" ? (
                          <button type="button" disabled={pending} onClick={() => act(() => confirmFoodLog(l.id))} className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium hover:bg-surface">
                            <Check aria-hidden="true" className="size-3.5" />
                            אישור
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => deleteFoodLog(l.id))}
                          aria-label="מחיקה"
                          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </button>
                      </span>
                    </div>
                    {l.items.map((i, k) => (
                      <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0">{describeItem(i)}</span>
                        {tracking ? (
                          <span className="shrink-0 text-xs text-ink-muted">
                            {i.kcal_min !== null ? <span className="num text-ink">{kcalOf(i)}</span> : null}
                            {i.protein_g ? (
                              <>
                                {" · "}
                                <span className="num">{Math.round(i.protein_g)}</span> ג׳
                              </>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p className="text-xs text-ink-faint">עוד לא נרשם</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
