"use client";

import { Beef, Carrot, Check, Clock, Footprints, Info, Moon, NotebookPen, Plus, StretchHorizontal, Trash2, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ExerciseDemo } from "@/components/exercise/exercise-demo";
import { ExerciseLoop } from "@/components/exercise/exercise-loop";
import { MUSCLES } from "@/content/muscles";
import { ACTIVITIES, ACTIVITY_KINDS, activityKcal, MINUTE_CHOICES, type ActivityKind } from "@/lib/fitness/activities";
import { addActivity, removeActivity, setExerciseDone, type FitnessResult } from "@/lib/fitness/actions";
import type { FitnessState } from "@/lib/menu/data";
import { minutesFor, type SmartTaskKind } from "@/lib/day/smart-tasks";
import { setSmartTaskDone } from "@/lib/fitness/actions";
import { useDay } from "./day-context";

export interface WorkoutBlock {
  index: number;
  slug: string;
  name: string;
  sets: number;
  reps?: number;
  seconds?: number;
  rest: number;
  perSide: boolean;
  primary: string[];
  steps: string[];
  cautions: string | null;
  easier: string | null;
}

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

const MOVEMENT_KINDS: SmartTaskKind[] = ["walk", "brisk_walk", "jog", "stretch", "steps_break"];
const planType = (k: SmartTaskKind) => (MOVEMENT_KINDS.includes(k) ? "movement" : k === "sleep" ? "recovery" : "habit");
const TASK_ICON: Record<SmartTaskKind, typeof Footprints> = {
  walk: Footprints,
  brisk_walk: Footprints,
  jog: Footprints,
  steps_break: Footprints,
  stretch: StretchHorizontal,
  protein: Beef,
  log_food: NotebookPen,
  veg: Carrot,
  sleep: Moon,
};

const muscleName = new Map<string, string>(MUSCLES.map((m) => [m.id, m.name_he]));

/**
 * Today's fitness: the workout's exercises as big tiles (the animation, then sets × reps in
 * large type), the day's small movement and recovery tasks, and general activities the user
 * adds ("walked 15 minutes").
 */
export function FitnessCard({
  workout,
  tasks,
  initial,
  weightKg,
  saved,
  demo = false,
}: {
  workout: { title: string; minutes: number; blocks: WorkoutBlock[] } | null;
  tasks: SmallTask[];
  initial: FitnessState;
  weightKg: number | null;
  saved: boolean;
  /** Keep changes in the page only (the demo without an account). */
  demo?: boolean;
}) {
  const { setWorkout, setActiveMinutes, setActions, eatenProtein } = useDay();
  const [fit, setFit] = useState(initial);
  const [sheet, setSheet] = useState<WorkoutBlock | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  const total = workout?.blocks.length ?? 0;
  const isDone = (b: WorkoutBlock) => fit.done.includes(`ex:${b.index}`);
  const doneCount = workout?.blocks.filter(isDone).length ?? 0;

  useEffect(() => setWorkout({ done: doneCount, total }), [doneCount, total, setWorkout]);
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

  function toggle(b: WorkoutBlock) {
    const key = `ex:${b.index}`;
    const done = !isDone(b);
    run({ ...fit, done: done ? [...fit.done, key] : fit.done.filter((k) => k !== key) }, () => setExerciseDone(b.index, done, total));
  }

  /** Movement tasks fill up from the activities added; the rest are ticked by hand (or done automatically). */
  const progressOf = (t: SmallTask) => (t.minutes ? Math.min(t.minutes, minutesFor(t.kind, fit.acts)) : 0);
  const isTaskDone = (t: SmallTask) =>
    t.auto || fit.done.includes(`t:${t.id}`) || (t.minutes ? progressOf(t) >= t.minutes : false) || (t.kind === "protein" && Boolean(t.grams) && eatenProtein >= (t.grams ?? 0));
  const tasksDone = tasks.filter(isTaskDone).length;
  useEffect(() => setActions({ done: doneCount + tasksDone, total: total + tasks.length }), [doneCount, tasksDone, total, tasks.length, setActions]);

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
            כושר היום
          </h2>
          <span className="text-xs text-ink-muted">
            {workout ? (
              <>
                {workout.title} · <Clock aria-hidden="true" className="inline size-3" /> <span className="num">{workout.minutes}</span> דק׳
              </>
            ) : (
              "יום בלי אימון כוח. אפשר להוסיף פעילות קלה."
            )}
          </span>
        </div>
        {workout ? (
          <span className="num rounded-full bg-accent px-3 py-1 text-sm font-semibold text-ink">
            {doneCount}/{total}
          </span>
        ) : null}
      </header>

      {workout ? (
        <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {workout.blocks.map((b) => (
            <ExerciseTile key={b.index} b={b} done={isDone(b)} saved={saved} onOpen={() => setSheet(b)} onToggle={() => toggle(b)} />
          ))}
        </ol>
      ) : null}

      {tasks.length ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">המשימות שלך להיום</h3>
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

      {sheet ? <ExerciseSheet b={sheet} done={isDone(sheet)} saved={saved} onToggle={() => toggle(sheet)} onClose={() => setSheet(null)} /> : null}
    </section>
  );
}

function Dose({ b, large = false }: { b: WorkoutBlock; large?: boolean }) {
  const big = large ? "text-5xl" : "text-[2rem]";
  return (
    <div className="flex items-end justify-center gap-2" dir="rtl">
      <span className="flex flex-col items-center leading-none">
        <span className={`num font-bold ${big}`}>{b.sets}</span>
        <span className="mt-1 text-[11px] text-ink-muted">סטים</span>
      </span>
      <span className={`pb-4 text-ink-faint ${large ? "text-2xl" : "text-lg"}`} aria-hidden="true">
        ×
      </span>
      <span className="flex flex-col items-center leading-none">
        <span className={`num font-bold ${big}`}>{b.reps ?? b.seconds}</span>
        <span className="mt-1 text-[11px] text-ink-muted">{b.reps !== undefined ? "חזרות" : "שניות"}</span>
      </span>
    </div>
  );
}

function ExerciseTile({ b, done, saved, onOpen, onToggle }: { b: WorkoutBlock; done: boolean; saved: boolean; onOpen: () => void; onToggle: () => void }) {
  return (
    <li className={`flex flex-col overflow-hidden rounded-xl ring-1 transition-colors ${done ? "bg-accent-soft ring-accent" : "bg-field/60 ring-line"}`}>
      <button type="button" onClick={onOpen} className="flex cursor-pointer flex-col gap-1 p-2 text-start" aria-label={`${b.name}: הדגמה והוראות`}>
        <div className="relative rounded-lg bg-surface">
          <ExerciseLoop slug={b.slug} highlight={b.primary} className="mx-auto h-24 w-full" />
          <Info aria-hidden="true" className="absolute top-1.5 start-1.5 size-4 text-ink-faint" />
        </div>
        <span className="line-clamp-2 min-h-10 text-sm leading-tight font-semibold">{b.name}</span>
        <Dose b={b} />
        <span className="text-center text-[11px] text-ink-muted">
          {b.perSide ? "לכל צד · " : ""}מנוחה <span className="num">{b.rest}</span> שנ׳
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={!saved}
        aria-pressed={done}
        className={`mt-auto flex min-h-10 cursor-pointer items-center justify-center gap-1.5 text-sm font-medium transition-colors disabled:cursor-default ${
          done ? "bg-brand text-accent" : "bg-surface text-ink hover:bg-brand hover:text-white"
        }`}
      >
        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        {done ? "בוצע" : "סיימתי"}
      </button>
    </li>
  );
}

function ExerciseSheet({ b, done, saved, onToggle, onClose }: { b: WorkoutBlock; done: boolean; saved: boolean; onToggle: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // No close() on cleanup: it would fire onClose and unmount the sheet in a strict-mode re-run.
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={b.name}
      className="m-auto mb-0 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-ink/40 sm:mb-auto sm:rounded-2xl"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{b.name}</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-field">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="rounded-xl bg-field py-3">
          <Dose b={b} large />
          <p className="mt-2 text-center text-xs text-ink-muted">
            {b.perSide ? "לכל צד · " : ""}מנוחה של <span className="num">{b.rest}</span> שניות בין סטים
          </p>
        </div>
        <ExerciseDemo slug={b.slug} name={b.name} highlight={b.primary} />
        {b.primary.length ? <p className="text-sm text-ink-muted">שרירים: {b.primary.map((m) => muscleName.get(m) ?? m).join(", ")}</p> : null}
        <ol className="flex flex-col gap-1.5 text-sm">
          {b.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="num shrink-0 font-semibold text-ink-muted">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {b.cautions ? (
          <p className="flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {b.cautions}
          </p>
        ) : null}
        {b.easier ? <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm">קשה מדי? אפשר להחליף ב{b.easier}.</p> : null}
        <button
          type="button"
          disabled={!saved}
          onClick={() => {
            onToggle();
            if (!done) onClose();
          }}
          className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 ${done ? "bg-brand-soft" : "bg-brand text-white hover:bg-brand-strong"}`}
        >
          <Check aria-hidden="true" className="size-4" />
          {done ? "בטל סימון" : "סיימתי את התרגיל"}
        </button>
      </div>
    </dialog>
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
