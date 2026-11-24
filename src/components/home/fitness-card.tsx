"use client";

import { Apple, Beef, Carrot, Check, Cookie, Dumbbell, Egg, Footprints, GlassWater, HeartPulse, Plus, StretchHorizontal, Trash2, Utensils, Wheat, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ACTIVITIES, ACTIVITY_KINDS, activityKcal, MINUTE_CHOICES, type ActivityKind } from "@/lib/fitness/activities";
import { addActivity, removeActivity, type FitnessResult } from "@/lib/fitness/actions";
import type { FitnessState } from "@/lib/menu/data";
import { MOVE_TASKS, minutesFor, type SmartTaskKind } from "@/lib/day/smart-tasks";
import { setSmartTaskDone } from "@/lib/fitness/actions";
import { useDay } from "./day-context";

export interface SmallTask {
  id: string;
  kind: SmartTaskKind;
  title: string;
  why: string;
  minutes?: number;
  /** Grams for the protein task: done as soon as the day's food reaches them. */
  grams?: number;
  /** Done without a tap: e.g. enough food logged, or protein reached. */
  auto: boolean;
}

const MOVE_KINDS = new Set<SmartTaskKind>(MOVE_TASKS);
const planType = (k: SmartTaskKind) => (MOVE_KINDS.has(k) ? "movement" : "habit");
const TASK_ICON: Record<SmartTaskKind, typeof Footprints> = {
  walk: Footprints,
  brisk_walk: Footprints,
  jog: Footprints,
  steps_break: Footprints,
  aerobic: HeartPulse,
  legs: Dumbbell,
  pushups: Dumbbell,
  cooldown: StretchHorizontal,
  stretch: StretchHorizontal,
  protein_breakfast: Egg,
  protein_lunch: Beef,
  protein_half: Beef,
  veg: Carrot,
  fruit: Apple,
  fiber: Wheat,
  swap_drink: GlassWater,
  real_meal: Utensils,
  light_dinner: Utensils,
  energy_snack: Cookie,
};

/**
 * The day's small movement and food tasks, and general activities the user adds ("walked 15
 * minutes"). Today's workout has its own card (TodayWorkout).
 */
export function FitnessCard({
  tasks,
  initial,
  weightKg,
  saved,
  demo = false,
}: {
  tasks: SmallTask[];
  initial: FitnessState;
  weightKg: number | null;
  saved: boolean;
  /** Keep changes in the page only (the demo without an account). */
  demo?: boolean;
}) {
  const { workout, setActiveMinutes, setActions, setTasks, eatenProtein } = useDay();
  const [fit, setFit] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  // The workout's exercises are counted by "האימון שלך היום"; they add up with the tasks here.
  const { done: doneCount, total } = workout;
  useEffect(() => setActiveMinutes(fit.acts.reduce((s, a) => s + a.min, 0)), [fit.acts, setActiveMinutes]);

  function run(next: FitnessState, call: () => Promise<FitnessResult>) {
    const prev = fit;
    setFit(next);
    setError(false);
    if (demo) return;
    start(async () => {
      const r = await call().catch((): FitnessResult => ({ ok: false }));
      if (r.ok) setFit(r.fitness);
      else {
        setFit(prev);
        setError(true);
      }
    });
  }

  /** Movement tasks fill up from the activities added; the rest are ticked by hand (or done automatically). */
  const progressOf = (t: SmallTask) => (t.minutes ? Math.min(t.minutes, minutesFor(t.kind, fit.acts)) : 0);
  const isTaskDone = (t: SmallTask) =>
    t.auto || fit.done.includes(`t:${t.id}`) || (t.minutes ? progressOf(t) >= t.minutes : false) || (t.kind === "protein_half" && Boolean(t.grams) && eatenProtein >= (t.grams ?? 0));
  const tasksDone = tasks.filter(isTaskDone).length;
  useEffect(() => setActions({ done: doneCount + tasksDone, total: total + tasks.length }), [doneCount, tasksDone, total, tasks.length, setActions]);
  const moves = tasks.filter((t) => MOVE_KINDS.has(t.kind));
  const movesDone = moves.filter(isTaskDone).length;
  useEffect(
    () => setTasks({ moves: { done: movesDone, total: moves.length }, other: { done: tasksDone - movesDone, total: tasks.length - moves.length } }),
    [movesDone, moves.length, tasksDone, tasks.length, setTasks],
  );

  function toggleTask(t: SmallTask) {
    const key = `t:${t.id}`;
    const done = !fit.done.includes(key);
    run({ ...fit, done: done ? [...fit.done, key] : fit.done.filter((k) => k !== key) }, () => setSmartTaskDone(t.id, done, planType(t.kind)));
  }

  function add(kind: ActivityKind, min: number) {
    setAdding(false);
    run({ ...fit, acts: [...fit.acts, { id: `tmp-${Date.now()}`, kind, min }] }, () => addActivity(kind, min));
  }

  return (
    <section aria-labelledby="fit-title" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 id="fit-title" className="text-lg font-semibold">
            משימות ופעילות
          </h2>
          <span className="text-xs text-ink-muted">משימות קטנות להיום, ופעילות שעשית מחוץ לאימון.</span>
        </div>
      </header>

      {tasks.length ? (
        <div className="flex flex-col gap-1.5">
          <h3 id="tasks" className="scroll-mt-6 text-sm font-semibold">המשימות שלך להיום</h3>
          <ul className="flex flex-col gap-2">
            {tasks.map((t) => {
              const Icon = TASK_ICON[t.kind];
              const done = isTaskDone(t);
              const p = progressOf(t);
              return (
                <li key={t.id} className={`flex items-start gap-3 rounded-xl p-3 ring-1 transition-colors ${done ? "bg-accent-soft ring-accent" : "bg-field/60 ring-line"}`}>
                  <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-brand text-accent" : "bg-surface text-ink"}`}>
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-[15px] leading-snug font-semibold ${done ? "text-ink-muted line-through decoration-1" : ""}`}>{t.title}</span>
                    <span className="text-xs leading-snug text-ink-muted">{t.why}</span>
                    {t.minutes && !done && p > 0 ? (
                      <span className="mt-1 flex items-center gap-2 text-xs">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <span className="block h-full rounded-full bg-accent-strong" style={{ width: `${(p / t.minutes) * 100}%` }} />
                        </span>
                        <span className="num">{p}/{t.minutes}</span> דק׳
                      </span>
                    ) : null}
                  </span>
                  {t.auto ? (
                    <Check aria-label="בוצע" className="mt-2 size-5 shrink-0 text-accent-strong" strokeWidth={3} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleTask(t)}
                      disabled={!saved}
                      aria-pressed={done}
                      aria-label={done ? `ביטול: ${t.title}` : `בוצע: ${t.title}`}
                      className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors disabled:cursor-default ${done ? "border-brand bg-brand text-accent" : "border-line bg-surface text-transparent hover:border-ink/40"}`}
                    >
                      <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {fit.acts.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-xl ring-1 ring-line">
          {fit.acts.map((a) => {
            const kcal = activityKcal(a.kind, a.min, weightKg);
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <Check aria-hidden="true" className="size-4 shrink-0 text-accent-strong" strokeWidth={3} />
                <span className="flex-1 text-sm">
                  {ACTIVITIES[a.kind as ActivityKind]?.label ?? a.kind} <span className="num">{a.min}</span> דק׳
                  {kcal ? <span className="text-xs text-ink-muted"> · כ-<span className="num">{kcal}</span> קל׳</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => run({ ...fit, acts: fit.acts.filter((x) => x.id !== a.id) }, () => removeActivity(a.id))}
                  aria-label="הסרה"
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-field hover:text-ink"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {saved ? adding ? <AddActivity onAdd={add} onClose={() => setAdding(false)} /> : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-medium transition-colors hover:border-ink/40 hover:bg-field"
        >
          <Plus aria-hidden="true" className="size-4" />
          הוספת פעילות (הליכה, ריצה, אופניים…)
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-warning">
          לא הצלחנו לשמור. נסו שוב.
        </p>
      ) : null}

      <Link href="/plan" className="text-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
        התוכנית השבועית
      </Link>

    </section>
  );
}

function AddActivity({ onAdd, onClose }: { onAdd: (k: ActivityKind, m: number) => void; onClose: () => void }) {
  const [kind, setKind] = useState<ActivityKind>("walk");
  const [min, setMin] = useState<number>(15);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-field p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">איזו פעילות?</span>
        <button type="button" onClick={onClose} aria-label="סגירה" className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-surface">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`min-h-8 cursor-pointer rounded-full px-3 text-sm transition-colors ${kind === k ? "bg-brand text-white" : "bg-surface hover:bg-line/60"}`}
          >
            {ACTIVITIES[k].label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-ink-muted">כמה זמן?</span>
        {MINUTE_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMin(m)}
            aria-pressed={min === m}
            className={`num min-h-8 min-w-11 cursor-pointer rounded-full px-2 text-sm transition-colors ${min === m ? "bg-brand text-white" : "bg-surface hover:bg-line/60"}`}
          >
            {m}
          </button>
        ))}
        <span className="text-sm text-ink-muted">דק׳</span>
      </div>
      <button type="button" onClick={() => onAdd(kind, min)} className="min-h-11 cursor-pointer rounded-xl bg-brand font-medium text-white hover:bg-brand-strong">
        הוספה: {ACTIVITIES[kind].label} {min} דק׳
      </button>
    </div>
  );
}
