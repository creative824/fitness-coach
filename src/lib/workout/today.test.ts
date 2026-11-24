import { describe, expect, it } from "vitest";
import { nearestDuration, sessionsOf, storedWorkoutOf } from "./today";

describe("stored workout", () => {
  it("keeps valid items and the chosen length", () => {
    const w = storedWorkoutOf({ minutes: 15, items: [{ slug: "bodyweight-squat", sets: 2, reps: 10, rest: 60 }, { slug: "plank", sets: 2, seconds: 30, rest: 45 }] });
    expect(w?.minutes).toBe(15);
    expect(w?.items).toHaveLength(2);
  });
  it("drops broken items and odd lengths", () => {
    const w = storedWorkoutOf({ minutes: 7, items: [{ slug: "x y", sets: 2, reps: 10, rest: 60 }, { slug: "plank", sets: 2, reps: 10, seconds: 30, rest: 45 }, { slug: "push-up", sets: 3, reps: 8, rest: 60 }] });
    expect(w?.minutes).toBeNull();
    expect(w?.items.map((i) => i.slug)).toEqual(["push-up"]);
    expect(storedWorkoutOf({ items: [] })).toBeUndefined();
    expect(storedWorkoutOf(null)).toBeUndefined();
  });
  it("keeps the last five sessions", () => {
    const one = { at: "2026-01-01T10:00:00Z", exercises: 3, done: 3, sets: 6, reps: 60, minutes: 12 };
    expect(sessionsOf(Array.from({ length: 7 }, () => one))).toHaveLength(5);
    expect(sessionsOf([{ at: 1 }])).toEqual([]);
  });
  it("rounds a plan's estimate to a length on offer", () => {
    expect(nearestDuration(35)).toBe(30);
    expect(nearestDuration(12)).toBe(10);
  });
});
