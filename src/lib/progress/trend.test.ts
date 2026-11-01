import { describe, expect, it } from "vitest";
import { activeDays, trendChange, weeklyAverages } from "./trend";

describe("weight trend", () => {
  it("averages per Sunday-to-Saturday week", () => {
    const w = weeklyAverages([
      { date: "2026-11-02", weight_kg: 80 },
      { date: "2026-11-05", weight_kg: 79 },
      { date: "2026-10-28", weight_kg: 81 },
    ]);
    expect(w).toEqual([
      { weekStart: "2026-10-25", avg: 81, count: 1 },
      { weekStart: "2026-11-01", avg: 79.5, count: 2 },
    ]);
    expect(trendChange(w)).toBe(-1.5);
  });
  it("needs two weeks for a trend", () => {
    expect(trendChange(weeklyAverages([{ date: "2026-11-02", weight_kg: 80 }]))).toBeNull();
  });
  it("counts a day as active from half the points", () => {
    expect(activeDays([
      { date: "a", earned: 20, possible: 40, done: 3, total: 6 },
      { date: "b", earned: 5, possible: 40, done: 1, total: 6 },
      { date: "c", earned: 0, possible: 0, done: 0, total: 0 },
    ])).toBe(1);
  });
});
