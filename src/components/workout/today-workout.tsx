"use client";

import { ArrowLeftRight, Check, ChevronDown, Clock, Minus, Pencil, Play, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ExerciseLoop } from "@/components/exercise/exercise-loop";
import { useDay } from "@/components/home/day-context";
import { finishWorkout, saveTodayWorkout, type FitnessResult } from "@/lib/fitness/actions";
import {
  alternatives,
  buildWorkout,
  DURATIONS,
  GROUP_LABEL,
  groupOf,
  suggestions,
  workoutMinutes,
  type Duration,
  type Group,
  type PoolExercise,
  type WorkoutItem,
} from "@/lib/workout/build";
import type { ExerciseResult, Summary } from "@/lib/workout/session";
import { MAX_ITEMS, type ExerciseCard } from "@/lib/workout/today";
import { WorkoutSession } from "./workout-session";

interface Plan {
  minutes: Duration | null;
  items: WorkoutItem[];
}

const dose = (i: WorkoutItem) => (i.seconds ? `${i.sets} × ${i.seconds} שנ׳` : `${i.sets} × ${i.reps}`);

/**
 * "האימון שלך היום" on the home screen: the exercises, how long, how far along, one big start
 * button. Tapping an exercise opens its prep screen; the pencil edits the whole workout. The
 * fitness score moves only when a guided session ends with "סיימתי אימון".
 */
export function TodayWorkout({
  initial,
  title,
  pool,
  cards,
  done: initialDone,
  seed,
  level,
  saved,
  demo = false,
}: {
  /** Today's workout, or null on a rest day of the plan. */
  initial: Plan | null;
  title: string | null;
  pool: PoolExercise[];
  cards: Record<string, ExerciseCard>;
  /** Exercises already counted today ("ex:<index>"). */
  done: string[];
  seed: string;
  level: PoolExercise["difficulty"];
  saved: boolean;
  demo?: boolean;
}) {
  const { setWorkout } = useDay();
  const [plan, setPlan] = useState<Plan | null>(initial);
  const [done, setDone] = useState(() => new Set(initialDone.filter((k) => k.startsWith("ex:"))));
  const [prep, setPrep] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();

  const items = plan?.items ?? [];
  const isDone = (k: number) => done.has(`ex:${k}`);
  const doneCount = items.filter((_, k) => isDone(k)).length;
  const minutes = items.length ? workoutMinutes(items) : 0;
  useEffect(() => setWorkout({ done: doneCount, total: items.length }), [doneCount, items.length, setWorkout]);

  const byslug = useMemo(() => new Map(pool.map((e) => [e.slug, e])), [pool]);
  const card = (slug: string): ExerciseCard => cards[slug] ?? { name: byslug.get(slug)?.name ?? slug, primary: byslug.get(slug)?.primary ?? [], steps: [], cautions: null, perSide: false };

  function handle(r: FitnessResult, okText?: string) {
    if (r.ok) {
      setDone(new Set(r.fitness.done.filter((k) => k.startsWith("ex:"))));
      if (okText) setNote({ ok: true, text: okText });
    } else setNote({ ok: false, text: "לא הצלחנו לשמור. נסו שוב." });
  }

  /** A changed workout: exercises that stayed in place keep their tick. */
  function commit(next: Plan) {
    const keep = new Set([...done].filter((k) => {
      const i = Number(k.slice(3));
      return next.items[i]?.slug === items[i]?.slug && JSON.stringify(next.items[i]) === JSON.stringify(items[i]);
    }));
    setPlan(next);
    setDone(keep);
    setNote(null);
    if (demo) return;
    start(async () => {
      const r = await saveTodayWorkout(next.minutes, next.items, [...keep].map((k) => Number(k.slice(3)))).catch((): FitnessResult => ({ ok: false }));
      handle(r);
    });
  }

  function finish(from: number, results: ExerciseResult[], summary: Summary) {
    const keys = results.flatMap((r, k) => (!r.skipped && r.sets > 0 ? [`ex:${from + k}`] : []));
    if (demo) {
      setDone(new Set([...done, ...keys]));
      setSession(null);
      setNote({ ok: true, text: "האימון נשמר וניקוד הכושר עודכן." });
      return;
    }
    setFinishing(true);
    start(async () => {
      const r = await finishWorkout({ from, total: items.length, results, summary }).catch((): FitnessResult => ({ ok: false }));
      setFinishing(false);
      if (r.ok) setSession(null);
      handle(r, "האימון נשמר וניקוד הכושר עודכן.");
    });
  }

  const firstOpen = items.findIndex((_, k) => !isDone(k));
  const allDone = items.length > 0 && firstOpen === -1;

  return (
    <section aria-labelledby="workout-title" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 id="workout-title" className="text-lg font-semibold">
            האימון שלך היום
          </h2>
          <span className="text-xs text-ink-muted">
            {items.length ? (
              <>
                {title ? `${title} · ` : ""}
                <span className="num">{items.length}</span> תרגילים · <Clock aria-hidden="true" className="inline size-3" /> כ-<span className="num">{minutes}</span> דק׳
              </>
            ) : (
              "לפי התוכנית היום יום מנוחה."
            )}
          </span>
        </div>
        {items.length && saved ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-field px-3 text-sm font-medium hover:bg-line/60"
          >
            <Pencil aria-hidden="true" className="size-4" />
            עריכה
          </button>
        ) : null}
      </header>

      {items.length ? (
        <>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="התקדמות באימון" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={items.length}>
              <span className="block h-full rounded-full bg-accent-strong transition-[width] duration-500" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </span>
            <span className="num">
              {doneCount}/{items.length}
            </span>
          </div>
          <ol className="flex flex-col gap-2">
            {items.map((i, k) => {
              const c = card(i.slug);
              const ok = isDone(k);
              return (
                <li key={`${k}-${i.slug}`}>
                  <button
                    type="button"
                    onClick={() => setPrep(k)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-start ring-1 transition-colors ${ok ? "bg-accent-soft ring-accent" : "bg-field/60 ring-line hover:bg-field"}`}
                  >
                    <span className="relative shrink-0 rounded-lg bg-surface">
                      <ExerciseLoop slug={i.slug} highlight={c.primary} className="size-16" />
                      {ok ? (
                        <span className="absolute -top-1 -start-1 flex size-5 items-center justify-center rounded-full bg-brand text-accent">
                          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{c.name}</span>
                      <span className="text-sm">
                        <span className="num font-semibold">{dose(i)}</span>
                        {c.perSide ? <span className="text-ink-muted"> לכל צד</span> : null}
                      </span>
                      <span className="text-xs text-ink-muted">
                        מנוחה <span className="num">{i.rest}</span> שנ׳
                        {byslug.get(i.slug) ? ` · ${GROUP_LABEL[groupOf(byslug.get(i.slug)!)]}` : ""}
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 rotate-90 text-ink-faint" />
                  </button>
                </li>
              );
            })}
          </ol>
          {saved ? (
            <button
              type="button"
              onClick={() => setSession(allDone ? 0 : firstOpen)}
              className={`inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl text-lg font-bold transition-transform active:scale-[0.98] ${allDone ? "bg-accent-soft text-ink ring-1 ring-accent" : "bg-brand text-white hover:bg-brand-strong"}`}
            >
              {allDone ? <Check aria-hidden="true" className="size-5" strokeWidth={3} /> : <Play aria-hidden="true" className="size-5" />}
              {allDone ? "האימון הושלם · לעשות שוב" : doneCount ? "המשך האימון" : "התחלת האימון"}
            </button>
          ) : null}
        </>
      ) : saved && pool.length ? (
        <div className="flex flex-col gap-2 rounded-xl bg-field/60 p-3">
          <span className="text-sm">רוצים בכל זאת להתאמן? בחרו כמה זמן יש לכם:</span>
          <DurationChips value={null} onPick={(d) => commit({ minutes: d, items: buildWorkout(pool, d, seed, level) })} />
        </div>
      ) : null}

      {note ? (
        <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "text-accent-strong" : "text-warning"}`}>
          {note.text}
        </p>
      ) : null}

      {prep !== null && items[prep] ? (
        <PrepSheet
          item={items[prep]}
          index={prep}
          total={items.length}
          card={card(items[prep].slug)}
          pool={pool}
          used={items.map((i) => i.slug)}
          cards={cards}
          onClose={() => setPrep(null)}
          onChange={(it) => commit({ minutes: null, items: items.map((x, k) => (k === prep ? it : x)) })}
          onStart={() => {
            setSession(prep);
            setPrep(null);
          }}
        />
      ) : null}

      {editing && plan ? (
        <EditSheet
          plan={plan}
          pool={pool}
          card={card}
          seed={seed}
          level={level}
          onClose={() => setEditing(false)}
          onSave={(p) => {
            setEditing(false);
            commit(p);
          }}
        />
      ) : null}

      {session !== null ? (
        <WorkoutSession
          items={items}
          info={Object.fromEntries(items.map((i) => [i.slug, card(i.slug)]))}
          from={session}
          finishing={finishing}
          error={note && !note.ok ? note.text : null}
          onExit={() => setSession(null)}
          onFinish={(results, summary) => finish(session, results, summary)}
        />
      ) : null}
    </section>
  );
}

function DurationChips({ value, onPick }: { value: Duration | null; onPick: (d: Duration) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="אורך האימון">
      {DURATIONS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onPick(d)}
          aria-pressed={value === d}
          className={`num min-h-10 min-w-14 cursor-pointer rounded-full px-3 text-sm font-medium transition-colors ${value === d ? "bg-brand text-white" : "bg-surface ring-1 ring-line hover:bg-field"}`}
        >
          {d} דק׳
        </button>
      ))}
    </div>
  );
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={label}
      className="m-auto mb-0 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-ink/40 sm:mb-auto sm:rounded-2xl"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{label}</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-field">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Stepper({ label, value, unit, min, max, step = 1, onChange }: { label: string; value: number; unit?: string; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-ink-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`פחות ${label}`} className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-field hover:bg-line/60 disabled:opacity-40">
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <span className="num min-w-10 text-center text-xl font-bold">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`יותר ${label}`} className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-field hover:bg-line/60 disabled:opacity-40">
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
      {unit ? <span className="text-[11px] text-ink-muted">{unit}</span> : null}
    </div>
  );
}

function ItemSteppers({ item, onChange }: { item: WorkoutItem; onChange: (i: WorkoutItem) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      <Stepper label="סטים" value={item.sets} min={1} max={6} onChange={(sets) => onChange({ ...item, sets })} />
      {item.seconds ? (
        <Stepper label="שניות" value={item.seconds} min={10} max={120} step={5} onChange={(seconds) => onChange({ ...item, seconds })} />
      ) : (
        <Stepper label="חזרות" value={item.reps ?? 10} min={3} max={30} onChange={(reps) => onChange({ ...item, reps })} />
      )}
      <Stepper label="מנוחה" value={item.rest} unit="שניות" min={15} max={180} step={15} onChange={(rest) => onChange({ ...item, rest })} />
    </div>
  );
}

type Feel = "easy" | "right" | "hard";

/** Before an exercise: what it is, how much, and a word on how it feels, then start. */
function PrepSheet({
  item,
  index,
  total,
  card,
  pool,
  used,
  cards,
  onClose,
  onChange,
  onStart,
}: {
  item: WorkoutItem;
  index: number;
  total: number;
  card: ExerciseCard;
  pool: PoolExercise[];
  used: string[];
  cards: Record<string, ExerciseCard>;
  onClose: () => void;
  onChange: (i: WorkoutItem) => void;
  onStart: () => void;
}) {
  const [feel, setFeel] = useState<Feel | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const tips = feel === "easy" || feel === "hard" ? suggestions(pool, item, feel) : [];
  const alts = swapping ? alternatives(pool, item.slug, used) : [];
  const dirty = JSON.stringify(draft) !== JSON.stringify(item);

  return (
    <Sheet label={card.name} onClose={onClose}>
      <p className="-mt-3 text-sm text-ink-muted">
        תרגיל {index + 1} מתוך {total}
      </p>
      <div className="rounded-xl bg-field p-3">
        <ExerciseLoop slug={item.slug} highlight={card.primary} className="mx-auto aspect-[4/3] w-full max-w-64" />
        <div className="mt-2 flex items-end justify-center gap-5 text-center">
          <Big value={item.sets} label="סטים" />
          <Big value={item.seconds ?? item.reps ?? 0} label={item.seconds ? "שניות" : card.perSide ? "חזרות לכל צד" : "חזרות"} />
          <Big value={item.rest} label="שנ׳ מנוחה" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">איך זה מרגיש לך?</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["easy", "קל לי מדי"],
              ["right", "מתאים לי"],
              ["hard", "קשה לי מדי"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFeel(k)}
              aria-pressed={feel === k}
              className={`min-h-11 cursor-pointer rounded-xl text-sm font-medium transition-colors ${feel === k ? "bg-brand text-white" : "bg-field hover:bg-line/60"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {feel === "right" ? <p className="text-sm text-accent-strong">מצוין, נשאר ככה. אפשר להתחיל.</p> : null}
        {tips.length ? (
          <ul className="flex flex-col gap-1.5">
            {tips.map((t) => (
              <li key={t.label}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(t.item);
                    setDraft(t.item);
                    setFeel(null);
                  }}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 text-start text-sm ring-1 ring-line hover:bg-field"
                >
                  {t.label}
                  <span className="text-xs font-semibold text-accent-strong">להחיל</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSwapping((v) => !v)} aria-expanded={swapping} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-field text-sm font-medium hover:bg-line/60">
          <ArrowLeftRight aria-hidden="true" className="size-4" />
          החלפת תרגיל
        </button>
        <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-field text-sm font-medium hover:bg-line/60">
          <Pencil aria-hidden="true" className="size-4" />
          עריכת הגדרות
        </button>
      </div>
      {swapping ? (
        alts.length ? (
          <ul className="flex flex-col gap-1.5" aria-label="תרגילים לאותה קבוצת שרירים">
            {alts.map((a) => (
              <li key={a.slug}>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...item, slug: a.slug };
                    onChange(next);
                    setDraft(next);
                    setSwapping(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-1.5 text-start ring-1 ring-line hover:bg-field"
                >
                  <ExerciseLoop slug={a.slug} highlight={a.primary} className="size-12 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{cards[a.slug]?.name ?? a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">אין עוד תרגיל מתאים לאותה קבוצת שרירים בציוד שלך.</p>
        )
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-2 rounded-xl ring-1 ring-line p-3">
          <ItemSteppers item={draft} onChange={setDraft} />
          <button
            type="button"
            disabled={!dirty}
            onClick={() => {
              onChange(draft);
              setEditing(false);
            }}
            className="min-h-11 cursor-pointer rounded-xl bg-brand-soft text-sm font-medium disabled:opacity-40"
          >
            שמירת השינויים
          </button>
        </div>
      ) : null}

      {card.steps.length ? (
        <details className="rounded-xl bg-field/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">איך עושים את זה נכון</summary>
          <ol className="mt-2 flex flex-col gap-1.5">
            {card.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="num shrink-0 font-semibold text-ink-muted">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {card.cautions ? (
        <p className="flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {card.cautions}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (dirty) onChange(draft);
          onStart();
        }}
        className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white hover:bg-brand-strong"
      >
        <Play aria-hidden="true" className="size-5" />
        התחלה
      </button>
    </Sheet>
  );
}

function Big({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex flex-col items-center leading-none">
      <span className="num text-4xl font-bold">{value}</span>
      <span className="mt-1 text-[11px] text-ink-muted">{label}</span>
    </span>
  );
}

const GROUP_ORDER: Group[] = ["legs", "push", "pull", "core", "cardio", "mobility"];

/** The whole workout: its length, each exercise's sets/reps/rest, swaps, and adding or removing. */
function EditSheet({
  plan,
  pool,
  card,
  seed,
  level,
  onClose,
  onSave,
}: {
  plan: Plan;
  pool: PoolExercise[];
  card: (slug: string) => ExerciseCard;
  seed: string;
  level: PoolExercise["difficulty"];
  onClose: () => void;
  onSave: (p: Plan) => void;
}) {
  const [p, setP] = useState(plan);
  const [open, setOpen] = useState<number | null>(null);
  const [swap, setSwap] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const byslug = new Map(pool.map((e) => [e.slug, e]));
  const groups = new Set(p.items.map((i) => byslug.get(i.slug)).filter(Boolean).map((e) => groupOf(e!)));
  const missing = GROUP_ORDER.slice(0, 4).filter((g) => !groups.has(g));
  const used = p.items.map((i) => i.slug);
  const set = (items: WorkoutItem[]) => setP({ minutes: null, items });
  const update = (k: number, i: WorkoutItem) => set(p.items.map((x, j) => (j === k ? i : x)));

  function add(e: PoolExercise) {
    const like = p.items[0];
    const base = { sets: like?.sets ?? 2, rest: like?.rest ?? 45 };
    set([...p.items, e.mode === "seconds" ? { slug: e.slug, ...base, seconds: 30 } : { slug: e.slug, ...base, reps: 10 }]);
    setAdding(false);
  }

  const addable = GROUP_ORDER.flatMap((g) => pool.filter((e) => groupOf(e) === g && !used.includes(e.slug)).map((e) => ({ g, e })));

  return (
    <Sheet label="עריכת האימון" onClose={onClose}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">כמה זמן יש לך היום?</span>
        <DurationChips value={p.minutes} onPick={(d) => setP({ minutes: d, items: buildWorkout(pool, d, seed, level) })} />
        <p className="text-xs text-ink-muted">בחירת זמן בונה את האימון מחדש, מאוזן בין רגליים, דחיפה, משיכה וליבה.</p>
      </div>

      <ol className="flex flex-col gap-2">
        {p.items.map((i, k) => {
          const c = card(i.slug);
          return (
            <li key={`${k}-${i.slug}`} className="flex flex-col gap-2 rounded-xl bg-field/60 p-2 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <ExerciseLoop slug={i.slug} highlight={c.primary} className="size-12 shrink-0 rounded-lg bg-surface" />
                <button type="button" onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k} className="flex min-w-0 flex-1 cursor-pointer flex-col text-start">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <span className="num text-xs text-ink-muted">
                    {dose(i)} · מנוחה {i.rest} שנ׳
                  </span>
                </button>
                <button type="button" onClick={() => setSwap(swap === k ? null : k)} aria-label={`החלפה: ${c.name}`} className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-surface">
                  <ArrowLeftRight aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => set(p.items.filter((_, j) => j !== k))}
                  disabled={p.items.length <= 1}
                  aria-label={`הסרה: ${c.name}`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-30"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
              {open === k ? <ItemSteppers item={i} onChange={(x) => update(k, x)} /> : null}
              {swap === k ? (
                <div className="flex flex-wrap gap-1.5">
                  {alternatives(pool, i.slug, used).map((a) => (
                    <button
                      key={a.slug}
                      type="button"
                      onClick={() => {
                        update(k, { ...i, slug: a.slug });
                        setSwap(null);
                      }}
                      className="min-h-9 cursor-pointer rounded-full bg-surface px-3 text-sm ring-1 ring-line hover:bg-field"
                    >
                      {card(a.slug).name}
                    </button>
                  ))}
                  {!alternatives(pool, i.slug, used).length ? <span className="text-xs text-ink-muted">אין עוד תרגיל מתאים לאותה קבוצת שרירים.</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {missing.length ? <p className="text-xs text-ink-muted">כדי לשמור על איזון כדאי להוסיף: {missing.map((g) => GROUP_LABEL[g]).join(", ")}.</p> : null}

      {p.items.length < MAX_ITEMS ? (
        adding ? (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl ring-1 ring-line p-2">
            {GROUP_ORDER.filter((g) => addable.some((x) => x.g === g))
              .sort((a, b) => Number(missing.includes(b)) - Number(missing.includes(a)))
              .map((g) => (
                <div key={g} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-muted">{GROUP_LABEL[g]}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {addable
                      .filter((x) => x.g === g)
                      .map(({ e }) => (
                        <button key={e.slug} type="button" onClick={() => add(e)} className="min-h-9 cursor-pointer rounded-full bg-field px-3 text-sm hover:bg-line/60">
                          {card(e.slug).name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-medium hover:bg-field">
            <Plus aria-hidden="true" className="size-4" />
            הוספת תרגיל
          </button>
        )
      ) : null}

      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-3 border-t border-line bg-surface p-4">
        <span className="text-sm text-ink-muted">
          כ-<span className="num font-semibold text-ink">{workoutMinutes(p.items)}</span> דק׳
        </span>
        <button type="button" onClick={() => onSave(p)} className="min-h-12 flex-1 cursor-pointer rounded-xl bg-brand font-medium text-white hover:bg-brand-strong">
          שמירת האימון
        </button>
      </div>
    </Sheet>
  );
}
