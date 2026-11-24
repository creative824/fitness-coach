"use client";

import { Check, ChevronLeft, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import type { WorkoutItem } from "@/lib/workout/build";
import { READY_MS, reduce, repProgress, startSession, summaryOf, type ExerciseResult, type Summary } from "@/lib/workout/session";
import { GuidedFigure } from "./guided-figure";

export interface ExerciseInfo {
  name: string;
  primary: string[];
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const CHEER = ["נשימה עמוקה, הכתפיים רפויות.", "שתייה קטנה ומתכוננים.", "יפה מאוד! הסט הבא יהיה עוד יותר טוב.", "מנוחה היא חלק מהאימון."];

/**
 * The guided workout, full screen: the figure moves with the count, rests run on their own,
 * and the summary ends with "סיימתי אימון". Only that button reports the results.
 */
export function WorkoutSession({
  items,
  info,
  from = 0,
  finishing = false,
  error = null,
  onExit,
  onFinish,
}: {
  items: WorkoutItem[];
  /** "סיימתי אימון" is being saved. */
  finishing?: boolean;
  error?: string | null;
  info: Record<string, ExerciseInfo>;
  from?: number;
  onExit: () => void;
  onFinish: (results: ExerciseResult[], summary: Summary) => void;
}) {
  const [s, dispatch] = useReducer(reduce, undefined, () => startSession(items, from));
  const last = useRef<number | null>(null);
  const prevPhase = useRef(s.phase);

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      if (last.current !== null) dispatch({ type: "tick", ms: Math.min(250, now - last.current) });
      last.current = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, []);

  // A short buzz when a set ends and when the next one starts (phones that support it).
  useEffect(() => {
    if (prevPhase.current !== s.phase && (s.phase === "rest" || s.phase === "exercise_done" || (prevPhase.current === "rest" && s.phase === "work"))) {
      try {
        navigator.vibrate?.(s.phase === "work" ? [80, 60, 80] : 200);
      } catch {}
    }
    prevPhase.current = s.phase;
  }, [s.phase]);

  // Keep the screen awake while training, where the browser allows it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l), () => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  const item = s.items[s.ex];
  const ex = info[item.slug] ?? { name: item.slug, primary: [] };
  const hold = Boolean(item.seconds);
  const total = hold ? 1 : (item.reps ?? 0);
  const progressInSet = hold ? repProgress(s) : (s.rep + repProgress(s)) / Math.max(1, total);
  const shownRep = Math.min(total, s.rep + 1);

  if (s.phase === "summary") {
    const sum = summaryOf(s);
    return (
      <Shell onExit={onExit} title="האימון הושלם!">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="flex size-24 items-center justify-center rounded-full bg-accent text-ink">
            <Check aria-hidden="true" className="size-12" strokeWidth={3} />
          </span>
          <h2 className="text-3xl font-bold">האימון הושלם!</h2>
          <dl className="grid w-full max-w-sm grid-cols-2 gap-3">
            <Stat label="תרגילים" value={`${sum.done} מתוך ${sum.exercises}`} />
            <Stat label="סטים" value={String(sum.sets)} />
            <Stat label="חזרות" value={String(sum.reps)} />
            <Stat label="דקות אימון" value={String(sum.minutes)} />
          </dl>
        </div>
        <button
          type="button"
          onClick={() => onFinish(s.results, sum)}
          disabled={finishing}
          className="min-h-14 w-full cursor-pointer rounded-2xl bg-accent text-lg font-bold text-ink transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {finishing ? "שומרים…" : "סיימתי אימון"}
        </button>
        {error ? (
          <p role="alert" className="text-center text-sm text-coral">
            {error}
          </p>
        ) : null}
      </Shell>
    );
  }

  if (s.phase === "exercise_done") {
    const r = s.results[s.results.length - 1];
    const nextItem = s.items[s.ex + 1];
    return (
      <Shell onExit={onExit} title={ex.name}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="text-5xl" aria-hidden="true">
            {r.skipped ? "⏭️" : "🎉"}
          </span>
          <h2 className="text-2xl font-bold">{r.skipped ? "דילגת על התרגיל" : "מעולה! השלמת את התרגיל."}</h2>
          <dl className="grid w-full max-w-sm grid-cols-3 gap-3">
            <Stat label="סטים" value={String(r.sets)} />
            <Stat label={hold ? "שניות" : "חזרות"} value={String(hold ? r.sets * (item.seconds ?? 0) : r.reps)} />
            <Stat label="זמן" value={mmss(r.seconds * 1000)} />
          </dl>
          {nextItem ? (
            <p className="text-white/70">
              הבא בתור: <span className="font-semibold text-white">{info[nextItem.slug]?.name ?? nextItem.slug}</span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "next_exercise" })}
          className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-bold text-ink"
        >
          לתרגיל הבא
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
      </Shell>
    );
  }

  if (s.phase === "rest") {
    const restTotal = item.rest * 1000;
    return (
      <Shell onExit={onExit} title={ex.name} paused={s.paused} onPause={() => dispatch({ type: s.paused ? "resume" : "pause" })}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <p className="rounded-full bg-accent px-4 py-1.5 font-semibold text-ink">
            סט {s.set} מתוך {item.sets} הושלם!
          </p>
          <p className="text-sm text-white/60">זמן מנוחה</p>
          <RestRing left={s.restLeft} total={Math.max(restTotal, s.restLeft)} label={mmss(s.restLeft)} />
          <p className="text-white/80">
            הבא: סט {s.set + 1} מתוך {item.sets} · {hold ? `${item.seconds} שניות` : `${item.reps} חזרות`}
          </p>
          <p className="text-sm text-white/55">{CHEER[(s.ex + s.set) % CHEER.length]}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Ctrl onClick={() => dispatch({ type: "add_rest", seconds: 15 })}>+15 שנ׳</Ctrl>
          <Ctrl onClick={() => dispatch({ type: "add_rest", seconds: 30 })}>+30 שנ׳</Ctrl>
          <Ctrl primary onClick={() => dispatch({ type: "skip_rest" })}>
            דילוג על המנוחה
          </Ctrl>
        </div>
      </Shell>
    );
  }

  // Ready or working.
  const ready = s.phase === "ready";
  return (
    <Shell onExit={onExit} title={ex.name} paused={s.paused} onPause={() => dispatch({ type: s.paused ? "resume" : "pause" })}>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-white/60">
          תרגיל {s.ex + 1} מתוך {s.items.length}
        </p>
        <p className="text-lg font-semibold">
          סט {s.set} מתוך {item.sets}
        </p>
      </div>
      <div className="relative flex flex-1 items-center justify-center">
        <GuidedFigure slug={item.slug} progress={ready ? 0 : repProgress(s)} hold={hold} highlight={ex.primary} className="aspect-square w-full max-w-[22rem] text-white" />
        {ready ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-night/70">
            <span className="text-sm text-white/70">מתחילים בעוד</span>
            <span className="num text-7xl font-bold text-accent">{Math.ceil((READY_MS - s.elapsed) / 1000)}</span>
          </div>
        ) : null}
        {s.paused ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-night/70">
            <span className="text-2xl font-bold">מושהה</span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col items-center gap-2">
        {hold ? (
          <p className="num text-6xl font-bold" aria-live="polite">
            {Math.max(0, Math.ceil((item.seconds ?? 0) - s.elapsed / 1000))}
            <span className="text-2xl text-white/60"> שנ׳</span>
          </p>
        ) : (
          <p className="text-center" aria-live="polite">
            <span className="text-sm text-white/60">חזרה</span>
            <br />
            <span className="num text-6xl font-bold">{ready ? 0 : shownRep}</span>
            <span className="num text-2xl text-white/60"> / {total}</span>
          </p>
        )}
        {!hold && !ready ? <p className="text-sm text-white/60">{repProgress(s) < 0.5 ? "יורדים…" : "עולים…"}</p> : null}
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="התקדמות בסט" aria-valuenow={Math.round(progressInSet * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, progressInSet * 100)}%` }} />
        </div>
        <div className="flex w-full gap-1" aria-hidden="true">
          {Array.from({ length: item.sets }, (_, k) => (
            <span key={k} className={`h-1.5 flex-1 rounded-full ${k + 1 < s.set ? "bg-accent" : k + 1 === s.set ? "bg-white/60" : "bg-white/15"}`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Ctrl onClick={() => dispatch({ type: "repeat_rep" })} disabled={ready || hold}>
          <RotateCcw aria-hidden="true" className="size-4" />
          חזרה על חזרה
        </Ctrl>
        <Ctrl primary onClick={() => dispatch({ type: s.paused ? "resume" : "pause" })}>
          {s.paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
          {s.paused ? "המשך" : "השהיה"}
        </Ctrl>
        <Ctrl onClick={() => dispatch({ type: "skip_exercise" })}>
          <SkipForward aria-hidden="true" className="size-4" />
          דילוג על תרגיל
        </Ctrl>
      </div>
    </Shell>
  );
}

function Shell({ title, children, onExit, paused, onPause }: { title: string; children: React.ReactNode; onExit: () => void; paused?: boolean; onPause?: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-night text-white">
      <div className="mx-auto flex h-full w-full max-w-lg flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
        <header className="flex items-center justify-between gap-3">
          <h1 className="truncate text-xl font-bold">{title}</h1>
          <span className="flex items-center gap-1">
            {onPause ? (
              <button type="button" onClick={onPause} aria-label={paused ? "המשך" : "השהיה"} className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                {paused ? <Play aria-hidden="true" className="size-5" /> : <Pause aria-hidden="true" className="size-5" />}
              </button>
            ) : null}
            <button type="button" onClick={onExit} aria-label="יציאה מהאימון" className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
              <X aria-hidden="true" className="size-5" />
            </button>
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}

function Ctrl({ children, onClick, primary = false, disabled = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-xs font-semibold transition-transform active:scale-95 disabled:cursor-default disabled:opacity-30 ${primary ? "bg-accent text-ink" : "bg-white/10 text-white"}`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] p-3">
      <dt className="text-xs text-white/60">{label}</dt>
      {/* Words in the value ("3 מתוך 4") read right to left; a bare number stays a numeral. */}
      <dd className={`text-2xl font-bold ${/^[\d:]+$/.test(value) ? "num" : ""}`}>{value}</dd>
    </div>
  );
}

function RestRing({ left, total, label }: { left: number; total: number; label: string }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex size-56 items-center justify-center">
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/10" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / Math.max(1, total))} className="text-accent" />
      </svg>
      <span className="num text-6xl font-bold" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
