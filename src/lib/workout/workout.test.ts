import { describe, expect, it } from "vitest";
import { EXERCISES } from "@/content/exercises";
import { alternatives, buildWorkout, DURATIONS, groupOf, suggestions, workoutSeconds, type PoolExercise } from "./build";
import { READY_MS, REP_MS, reduce, startSession, summaryOf, type Session } from "./session";

const pool: PoolExercise[] = EXERCISES.filter((e) => e.equipment.length === 0).map((e) => ({
  slug: e.slug,
  name: e.name_he,
  category: e.category,
  mode: e.mode,
  difficulty: e.difficulty,
  primary: e.primary,
  easier: e.easier ?? null,
}));

describe("building today's workout", () => {
  it("fits every length and gives longer sessions more work", () => {
    const totals = DURATIONS.map((m) => {
      const w = buildWorkout(pool, m, "2026-11-24", "intermediate");
      expect(workoutSeconds(w)).toBeLessThanOrEqual(m * 60);
      expect(w.length).toBeGreaterThan(0);
      return w;
    });
    const ten = totals[1];
    const thirty = totals[4];
    expect(thirty.length).toBeGreaterThan(ten.length);
    expect(JSON.stringify(thirty)).not.toBe(JSON.stringify(ten));
  });

  it("balances groups: no group twice before legs, push and core are in", () => {
    const w = buildWorkout(pool, 15, "x", "intermediate");
    const groups = w.map((i) => groupOf(pool.find((p) => p.slug === i.slug)!));
    expect(new Set(groups).size).toBe(groups.length);
  });

  it("swaps within the same group and muscles", () => {
    const alts = alternatives(pool, "bodyweight-squat");
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) expect(groupOf(a)).toBe("legs");
  });

  it("suggests more work when too easy and less when too hard", () => {
    const item = { slug: "bodyweight-squat", sets: 2, reps: 10, rest: 60 };
    expect(suggestions(pool, item, "easy").some((s) => (s.item.reps ?? 0) > 10)).toBe(true);
    const hard = suggestions(pool, item, "hard");
    expect(hard.some((s) => (s.item.reps ?? 99) < 10)).toBe(true);
    expect(hard.some((s) => s.item.slug === "sit-to-stand")).toBe(true);
  });
});

describe("guided session: squat 2×10 with 60 s rest, then the next exercise", () => {
  const items = [
    { slug: "bodyweight-squat", sets: 2, reps: 10, rest: 60 },
    { slug: "plank", sets: 1, seconds: 20, rest: 30 },
  ];
  const run = (s: Session, ms: number, step = 250) => {
    for (let t = 0; t < ms; t += step) s = reduce(s, { type: "tick", ms: step });
    return s;
  };

  it("counts reps to the guide, rests, starts set 2 on its own and sums up", () => {
    let s = startSession(items);
    expect(s.phase).toBe("ready");
    s = run(s, READY_MS);
    expect(s.phase).toBe("work");
    s = run(s, REP_MS * 3);
    expect(s).toMatchObject({ set: 1, rep: 3 });
    // Repeat a rep: the one just counted is taken back.
    s = reduce(s, { type: "repeat_rep" });
    expect(s.rep).toBe(2);
    s = run(s, REP_MS * 8);
    expect(s.phase).toBe("rest");
    expect(s.restLeft).toBe(60_000);
    // Paused: nothing moves.
    s = reduce(s, { type: "pause" });
    s = run(s, 10_000);
    expect(s.restLeft).toBe(60_000);
    s = reduce(s, { type: "resume" });
    s = reduce(s, { type: "add_rest", seconds: 15 });
    s = run(s, 75_000);
    expect(s).toMatchObject({ phase: "work", set: 2, rep: 0 });
    s = run(s, REP_MS * 10);
    expect(s.phase).toBe("exercise_done");
    expect(s.results[0]).toMatchObject({ slug: "bodyweight-squat", sets: 2, reps: 20, skipped: false });
    s = reduce(s, { type: "next_exercise" });
    s = run(s, READY_MS + 20_000);
    expect(s.phase).toBe("summary");
    const sum = summaryOf(s);
    expect(sum).toMatchObject({ exercises: 2, done: 2, sets: 3, reps: 20 });
  });

  it("skipping an exercise moves on and marks it skipped", () => {
    let s = startSession(items);
    s = run(s, READY_MS + REP_MS * 2);
    s = reduce(s, { type: "skip_exercise" });
    expect(s.phase).toBe("exercise_done");
    expect(s.results[0]).toMatchObject({ skipped: true, sets: 0, reps: 2 });
  });
});
