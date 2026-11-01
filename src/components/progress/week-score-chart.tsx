"use client";

import { Check, Dumbbell, Footprints, Droplets, Moon, Salad, Sparkles } from "lucide-react";
import { useState } from "react";
import type { WeekDay } from "@/lib/progress/data";

const ICON: Record<string, typeof Salad> = { meal: Salad, workout: Dumbbell, movement: Footprints, water: Droplets, recovery: Moon, habit: Sparkles };
const dayShort = new Intl.DateTimeFormat("he-IL", { weekday: "short", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const at = (d: string) => new Date(`${d}T00:00:00Z`);
const STATUS: Record<string, string> = { done: "בוצע", partial: "חלקית", swapped: "הוחלף", skipped: "דולג", pending: "לא סומן" };

/**
 * Daily points of one week, Sunday to Saturday (follow-up spec §8). Each bar shows the points
 * out of what was possible that day; tapping a day opens what was done. A weak day is shown as
 * it is, with no red and no "failed".
 */
export function WeekScoreChart({ days, today }: { days: WeekDay[]; today: string }) {
  const initial = days.findIndex((d) => d.date === today);
  const [selected, setSelected] = useState(initial >= 0 ? initial : 0);
  const max = Math.max(1, ...days.map((d) => d.possible));
  const day = days[selected];
  const done = day.tasks.filter((t) => t.earned > 0);
  const open = day.tasks.filter((t) => t.earned === 0);

  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-7 items-end gap-1.5" aria-label="נקודות לפי יום">
        {days.map((d, i) => {
          const future = d.date > today;
          const h = d.possible ? Math.round((d.possible / max) * 100) : 0;
          const fill = d.possible ? Math.round((d.earned / d.possible) * 100) : 0;
          return (
            <li key={d.date}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
                aria-label={`${dayLong.format(at(d.date))}: ${d.earned} מתוך ${d.possible} נקודות`}
                className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg p-1 transition-colors ${i === selected ? "bg-accent-soft" : "hover:bg-field"}`}
              >
                <span className="num text-[11px] font-semibold leading-none">{future || !d.possible ? "–" : d.earned}</span>
                <span className="flex h-28 w-full items-end overflow-hidden rounded-md bg-field">
                  <span className="relative flex w-full items-end rounded-md bg-line/70" style={{ height: `${Math.max(h, d.possible ? 8 : 0)}%` }}>
                    <span className="w-full rounded-md bg-brand transition-[height]" style={{ height: `${future ? 0 : fill}%` }} />
                  </span>
                </span>
                <span className={`text-[11px] ${d.date === today ? "font-bold text-ink" : "text-ink-muted"}`}>{dayShort.format(at(d.date))}</span>
                <span className="num text-[10px] leading-none text-ink-muted">{d.possible ? `/${d.possible}` : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <section aria-live="polite" className="flex flex-col gap-2 rounded-xl bg-field p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">{dayLong.format(at(day.date))}</h3>
          <span className="num text-sm text-ink-muted">
            {day.earned} מתוך {day.possible} נק׳
          </span>
        </div>
        {!day.tasks.length ? (
          <p className="text-sm text-ink-muted">אין משימות ליום הזה.</p>
        ) : day.date > today ? (
          <p className="text-sm text-ink-muted">{day.tasks.length} משימות מחכות ליום הזה.</p>
        ) : (
          <>
            {done.length ? (
              <ul className="flex flex-col gap-1.5">
                {done.map((t, i) => {
                  const Icon = ICON[t.type] ?? Sparkles;
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                      <span className="flex-1">{t.title}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                        <Check aria-hidden="true" className="size-3.5" />
                        {STATUS[t.status] ?? ""} · <span className="num">+{t.earned}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">לא סומנו משימות ביום הזה. זה קורה, וזה חלק מהדרך.</p>
            )}
            {open.length && done.length ? <p className="text-xs text-ink-muted">ועוד {open.length} משימות שלא סומנו.</p> : null}
          </>
        )}
      </section>
    </div>
  );
}
