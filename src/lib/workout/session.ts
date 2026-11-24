/**
 * The guided workout as a state machine: get ready → reps counted to the guide's pace → rest
 * with a countdown → the next set starts on its own → exercise done → the next exercise → summary.
 * Time only moves through `tick`, so the screen drives it with requestAnimationFrame and the
 * tests drive it with plain numbers. Pure.
 */
import { REP_SECONDS, type WorkoutItem } from "./build";

export const READY_MS = 3000;
export const REP_MS = REP_SECONDS * 1000;

export type Phase = "ready" | "work" | "rest" | "exercise_done" | "summary";

export interface ExerciseResult {
  slug: string;
  sets: number;
  reps: number;
  /** Time on the exercise, rests included, s. */
  seconds: number;
  /** Seconds per set, for holds (0 for reps). */
  hold: number;
  skipped: boolean;
}

export interface Session {
  items: WorkoutItem[];
  /** Index of the current exercise. */
  ex: number;
  phase: Phase;
  /** 1-based set of the current exercise. */
  set: number;
  /** Reps finished in the current set. */
  rep: number;
  /** Time spent in the current phase (or rep, while working), ms. */
  elapsed: number;
  /** Rest left, ms. */
  restLeft: number;
  paused: boolean;
  /** Work time of the whole session, ms (pauses not counted). */
  activeMs: number;
  /** When the current exercise started, in active ms. */
  exStartedAt: number;
  results: ExerciseResult[];
}

export type Action =
  | { type: "tick"; ms: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "repeat_rep" }
  | { type: "count_rep" }
  | { type: "skip_rest" }
  | { type: "add_rest"; seconds: number }
  | { type: "skip_exercise" }
  | { type: "next_exercise" };

export function startSession(items: WorkoutItem[], from = 0): Session {
  return { items, ex: from, phase: "ready", set: 1, rep: 0, elapsed: 0, restLeft: 0, paused: false, activeMs: 0, exStartedAt: 0, results: [] };
}

const current = (s: Session) => s.items[s.ex];
const isHold = (i: WorkoutItem) => Boolean(i.seconds);

/** Fraction of the current rep or hold (0..1), for the animation. */
export function repProgress(s: Session): number {
  const i = current(s);
  if (!i || s.phase !== "work") return 0;
  if (isHold(i)) return Math.min(1, s.elapsed / (i.seconds! * 1000));
  return Math.min(1, s.elapsed / REP_MS);
}

function finishSet(s: Session): Session {
  const i = current(s);
  if (s.set < i.sets) return { ...s, phase: "rest", restLeft: i.rest * 1000, elapsed: 0, rep: 0 };
  return finishExercise(s, false);
}

function finishExercise(s: Session, skipped: boolean): Session {
  const i = current(s);
  const doneSets = skipped ? s.set - 1 : i.sets;
  const result: ExerciseResult = {
    slug: i.slug,
    sets: Math.max(0, doneSets),
    reps: isHold(i) ? 0 : Math.max(0, doneSets) * (i.reps ?? 0) + (skipped ? s.rep : 0),
    seconds: Math.round((s.activeMs - s.exStartedAt) / 1000),
    hold: i.seconds ?? 0,
    skipped,
  };
  const results = [...s.results, result];
  const last = s.ex >= s.items.length - 1;
  return { ...s, results, phase: last ? "summary" : "exercise_done", elapsed: 0, rep: 0 };
}

export function reduce(s: Session, a: Action): Session {
  switch (a.type) {
    case "pause":
      return s.phase === "summary" ? s : { ...s, paused: true };
    case "resume":
      return { ...s, paused: false };
    case "repeat_rep":
      // The rep that is going now starts again; one that was just counted is taken back.
      if (s.phase !== "work") return s;
      return s.elapsed > 400 || s.rep === 0 ? { ...s, elapsed: 0 } : { ...s, rep: s.rep - 1, elapsed: 0 };
    case "count_rep": {
      // A tap counts a rep at once, for those who move faster than the guide.
      const i = current(s);
      if (s.phase !== "work" || isHold(i)) return s;
      const rep = s.rep + 1;
      return rep >= (i.reps ?? 0) ? finishSet({ ...s, rep }) : { ...s, rep, elapsed: 0 };
    }
    case "skip_rest":
      return s.phase === "rest" ? { ...s, phase: "work", set: s.set + 1, rep: 0, elapsed: 0, restLeft: 0 } : s;
    case "add_rest":
      return s.phase === "rest" ? { ...s, restLeft: s.restLeft + a.seconds * 1000 } : s;
    case "skip_exercise":
      return s.phase === "summary" ? s : finishExercise(s, true);
    case "next_exercise":
      return s.phase === "exercise_done" ? { ...s, ex: s.ex + 1, phase: "ready", set: 1, rep: 0, elapsed: 0, exStartedAt: s.activeMs } : s;
    case "tick":
      return tick(s, a.ms);
  }
}

function tick(s: Session, ms: number): Session {
  if (s.paused || ms <= 0) return s;
  if (s.phase === "exercise_done" || s.phase === "summary") return s;
  let next: Session = { ...s, activeMs: s.activeMs + ms };
  if (next.phase === "ready") {
    const elapsed = next.elapsed + ms;
    return elapsed >= READY_MS ? { ...next, phase: "work", elapsed: elapsed - READY_MS } : { ...next, elapsed };
  }
  if (next.phase === "rest") {
    const restLeft = next.restLeft - ms;
    return restLeft <= 0 ? { ...next, phase: "work", set: next.set + 1, rep: 0, elapsed: 0, restLeft: 0 } : { ...next, restLeft };
  }
  // Working.
  const i = current(next);
  let elapsed = next.elapsed + ms;
  if (isHold(i)) {
    return elapsed >= i.seconds! * 1000 ? finishSet({ ...next, elapsed: 0 }) : { ...next, elapsed };
  }
  let rep = next.rep;
  while (elapsed >= REP_MS) {
    elapsed -= REP_MS;
    rep += 1;
    if (rep >= (i.reps ?? 0)) return finishSet({ ...next, rep });
  }
  next = { ...next, rep, elapsed };
  return next;
}

export interface Summary {
  exercises: number;
  done: number;
  sets: number;
  reps: number;
  minutes: number;
}

export function summaryOf(s: Session): Summary {
  return {
    exercises: s.items.length,
    done: s.results.filter((r) => !r.skipped).length,
    sets: s.results.reduce((a, r) => a + r.sets, 0),
    reps: s.results.reduce((a, r) => a + r.reps, 0),
    minutes: Math.max(1, Math.round(s.activeMs / 60000)),
  };
}
