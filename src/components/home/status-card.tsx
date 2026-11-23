"use client";

import { Beef, Droplet, Dumbbell, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { calorieScore, scoreWord, taskScore, weekAverage } from "@/lib/day/scores";
import { addWaterFill } from "@/lib/water/actions";
import { CalorieRing } from "./calorie-ring";
import { WeightTracker, type WeightInfo } from "./weight-tracker";
import { fmt, useDay } from "./day-context";

export interface WeekDayStat {
  date: string;
  /** א׳ ב׳ … */
  letter: string;
  kcal: number | null;
  workout: "done" | "partial" | "planned" | "none";
  isToday: boolean;
  future: boolean;
  /** Scores of a past day (today's are worked out live on the screen). */
  calorieScore: number | null;
  taskScore: number | null;
}

export interface WaterMini {
  drank: number;
  target: number | null;
  vesselMl: number;
  taskId: string | null;
}

/**
 * The status panel under the competitions: today (calories ring, workout progress, water,
 * weight) or the week (calories per day against the target, workouts done).
 */
export function StatusCard({
  target,
  showNumbers,
  week,
  water,
  weight,
  proteinTarget = null,
  localWeight = false,
}: {
  target: number | null;
  showNumbers: boolean;
  week: WeekDayStat[];
  water: WaterMini | null;
  /** Weigh-ins for the weight row, or null when weight is not shown (health answers). */
  weight: WeightInfo | null;
  /** Keep weigh-ins in the page only (the demo). */
  localWeight?: boolean;
  /** Grams of protein for the day, or null without a weight or with numbers hidden. */
  proteinTarget?: number | null;
}) {
  const [tab, setTab] = useState<"day" | "week">("day");
  const { eatenKcal, eatenProtein, actions } = useDay();
  const kcalTarget = showNumbers ? target : null;
  const protein = showNumbers && proteinTarget ? { eaten: eatenProtein, target: proteinTarget } : null;
  const todayCal = calorieScore(eatenKcal, kcalTarget, true);
  const today = taskScore({ calorie: todayCal, protein, actions });
  const past = week.filter((d) => !d.future && !d.isToday);
  const weekCal = weekAverage([...past.map((d) => d.calorieScore), todayCal]);
  const weekTask = weekAverage([...past.map((d) => d.taskScore), today.score]);
  return (
    <section aria-label="תמונת מצב" className="rounded-[var(--radius-card)] bg-night p-4 text-white shadow-[var(--shadow-float)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-white/70">תמונת מצב</h2>
        <div role="tablist" aria-label="טווח" className="flex rounded-lg bg-white/10 p-0.5 text-sm">
          {(
            [
              ["day", "היום"],
              ["week", "השבוע"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-8 cursor-pointer rounded-md px-3 transition-colors ${tab === k ? "bg-accent font-medium text-ink" : "text-white/70 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <ScoreTile
          label="מדד קלוריות"
          fresh={tab === "day"}
          score={tab === "day" ? todayCal : weekCal}
          note={kcalTarget === null ? "בלי ספירת קלוריות" : tab === "day" ? "כמה קרוב ליעד היום" : "ממוצע הימים השבוע"}
        />
        <ScoreTile
          label="מדד משימות"
          fresh={tab === "day"}
          score={tab === "day" ? today.score : weekTask}
          note={
            tab === "day"
              ? [
                  today.parts.calories !== null ? `קלוריות ${today.parts.calories}` : null,
                  today.parts.protein !== null ? `חלבון ${today.parts.protein}` : null,
                  today.parts.actions !== null ? `פעולות ${today.parts.actions}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "קלוריות, חלבון ופעולות"
              : "ממוצע הימים השבוע"
          }
        />
      </div>
      {tab === "day" ? <DayView proteinTarget={protein?.target ?? null} target={target} showNumbers={showNumbers} water={water} weight={weight} localWeight={localWeight} /> : <WeekView target={target} showNumbers={showNumbers} week={week} />}
    </section>
  );
}

/** One score, 0–100, with a small ring. */
function ScoreTile({ label, score, note, fresh = false }: { label: string; score: number | null; note: string; fresh?: boolean }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const tone = score === null ? "text-white/20" : score >= 65 ? "text-accent" : score >= 40 ? "text-sky" : "text-coral";
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] p-2.5">
      <span className="relative flex size-11 shrink-0 items-center justify-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (score ?? 0) / 100)}
            className={`${tone} transition-[stroke-dashoffset] duration-700`}
          />
        </svg>
        <span className="num text-sm font-semibold">{score ?? "–"}</span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[11px] text-white/60">{fresh && !score ? "היום רק התחיל" : scoreWord(score)}</span>
        <span className="truncate text-[10px] text-white/45">{note}</span>
      </span>
    </div>
  );
}

function DayView({
  target,
  showNumbers,
  water,
  weight,
  proteinTarget,
  localWeight,
}: {
  target: number | null;
  showNumbers: boolean;
  water: WaterMini | null;
  weight: WeightInfo | null;
  localWeight: boolean;
  proteinTarget: number | null;
}) {
  const { eatenKcal, eatenProtein, workout, activeMinutes } = useDay();
  const left = target !== null ? target - eatenKcal : null;
  const pct = workout.total ? Math.round((workout.done / workout.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {showNumbers && target ? (
          <div className="flex flex-col items-center gap-1.5">
            <CalorieRing eaten={eatenKcal} target={target} />
            <span className="text-xs text-white/70">
              {left! >= 0 ? (
                <>
                  נשארו <span className="num font-semibold text-white">{fmt(left!)}</span> קל׳
                </>
              ) : (
                <>
                  מעל היעד ב-<span className="num font-semibold text-coral">{fmt(-left!)}</span>
                </>
              )}
            </span>
          </div>
        ) : (
          <div className="flex size-[132px] shrink-0 flex-col items-center justify-center rounded-full ring-[11px] ring-white/10">
            <span className="text-sm text-white/70">בלי ספירת</span>
            <span className="text-sm text-white/70">קלוריות</span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Dumbbell aria-hidden="true" className="size-4 text-accent" />
                כושר היום
              </span>
              {workout.total ? (
                <span className="num text-white/80">
                  {workout.done}/{workout.total}
                </span>
              ) : null}
            </span>
            {workout.total ? (
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="התקדמות באימון">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
            ) : (
              <span className="text-xs text-white/60">אין אימון היום. הליכה קלה תעשה טוב.</span>
            )}
            <span className="text-xs text-white/60">
              {workout.total ? (workout.done >= workout.total ? "האימון הושלם 💪" : `בוצעו ${workout.done} מתוך ${workout.total} תרגילים`) : null}
              {activeMinutes ? (
                <>
                  {workout.total ? " · " : ""}
                  <span className="num">{activeMinutes}</span> דק׳ פעילות
                </>
              ) : null}
            </span>
          </div>

          {proteinTarget ? (
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <Beef aria-hidden="true" className="size-4 text-coral" />
                  חלבון
                </span>
                <span className="text-white/80">
                  <span className="num">{Math.round(eatenProtein)}</span>/<span className="num">{proteinTarget}</span> ג׳
                </span>
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(eatenProtein)} aria-valuemin={0} aria-valuemax={proteinTarget} aria-label="חלבון היום">
                <div className="h-full rounded-full bg-coral transition-[width] duration-500" style={{ width: `${Math.min(100, (eatenProtein / proteinTarget) * 100)}%` }} />
              </div>
            </div>
          ) : null}

          {water ? <WaterRow water={water} /> : null}
        </div>
      </div>

      {weight ? <WeightTracker info={weight} local={localWeight} /> : null}
    </div>
  );
}

function WaterRow({ water }: { water: WaterMini }) {
  const [drank, setDrank] = useState(water.drank);
  const [, start] = useTransition();
  const cups = water.target ? Math.max(1, Math.round(water.target / water.vesselMl)) : null;
  const done = Math.floor(drank / water.vesselMl);

  function add() {
    const size = water.vesselMl;
    const before = water.target !== null && drank >= water.target;
    const after = water.target !== null && drank + size >= water.target;
    setDrank((d) => d + size);
    start(async () => {
      const r = await addWaterFill(size, water.taskId, before === after ? null : after).catch(() => ({ ok: false }));
      if (!r.ok) setDrank((d) => d - size);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <Droplet aria-hidden="true" className="size-4 fill-sky text-sky" />
        מים
        <span className="num font-normal text-white/80">
          {done}
          {cups ? `/${cups}` : ""}
        </span>
        <span className="text-xs font-normal text-white/50">כוסות</span>
      </span>
      <button
        type="button"
        onClick={add}
        aria-label="שתיתי כוס"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-white/10 transition-[background-color,transform] hover:bg-white/20 active:scale-95"
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function WeekView({ target, showNumbers, week }: { target: number | null; showNumbers: boolean; week: WeekDayStat[] }) {
  const { eatenKcal } = useDay();
  const days = week.map((d) => (d.isToday ? { ...d, kcal: eatenKcal || d.kcal } : d));
  const logged = days.filter((d) => d.kcal && !d.future);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + (d.kcal ?? 0), 0) / logged.length) : null;
  const onTarget = target ? logged.filter((d) => Math.abs((d.kcal ?? 0) - target) <= target * 0.1).length : 0;
  const workouts = days.filter((d) => d.workout === "done" || d.workout === "partial").length;
  const planned = days.filter((d) => d.workout !== "none").length;
  const max = Math.max(target ?? 0, ...days.map((d) => d.kcal ?? 0)) * 1.1 || 1;

  return (
    <div className="flex flex-col gap-4">
      {showNumbers && target ? (
        <div className="relative flex h-28 items-end gap-2" aria-label="קלוריות לפי יום">
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/60" style={{ bottom: `${(target / max) * 100}%` }} aria-hidden="true" />
          {days.map((d) => {
            const h = d.kcal ? Math.max(6, (d.kcal / max) * 100) : 0;
            const over = d.kcal !== null && d.kcal > target * 1.1;
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={`w-full max-w-7 rounded-md transition-[height] duration-500 ${d.future ? "bg-white/5" : over ? "bg-coral" : "bg-accent"} ${d.isToday ? "ring-2 ring-white/60" : ""}`}
                  style={{ height: d.kcal ? `${h}%` : "4px", opacity: d.kcal ? 1 : 0.3 }}
                  title={d.kcal ? `${d.kcal} קל׳` : "לא נרשם"}
                />
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="flex gap-2">
        {days.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className={`text-xs ${d.isToday ? "font-semibold text-white" : "text-white/60"}`}>{d.letter}</span>
            <span
              aria-label={d.workout === "done" ? "אימון הושלם" : d.workout === "partial" ? "אימון חלקי" : d.workout === "planned" ? "אימון מתוכנן" : "בלי אימון"}
              className={`size-2.5 rounded-full ${d.workout === "done" ? "bg-accent" : d.workout === "partial" ? "bg-accent/50" : d.workout === "planned" ? "bg-white/25" : "bg-transparent ring-1 ring-white/15"}`}
            />
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[0.06] p-2">
          <dt className="text-[11px] text-white/60">ממוצע ליום</dt>
          <dd className="num text-lg font-semibold">{showNumbers && avg ? fmt(avg) : "–"}</dd>
        </div>
        <div className="rounded-xl bg-white/[0.06] p-2">
          <dt className="text-[11px] text-white/60">ימים ביעד</dt>
          <dd className="num text-lg font-semibold">{showNumbers ? onTarget : "–"}</dd>
        </div>
        <div className="rounded-xl bg-white/[0.06] p-2">
          <dt className="text-[11px] text-white/60">אימונים</dt>
          <dd className="num text-lg font-semibold">
            {workouts}/{planned}
          </dd>
        </div>
      </dl>
      <Link href="/progress" className="text-center text-sm text-white/70 underline underline-offset-4 hover:text-white">
        מעקב מלא: שבוע, חודש ומשקל
      </Link>
    </div>
  );
}
