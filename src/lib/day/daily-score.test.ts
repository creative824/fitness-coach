import { describe, expect, it } from "vitest";
import { dayMessage } from "./message";
import { calorieScore, dailyScore } from "./scores";

const none = { done: 0, total: 0 };

describe("dailyScore", () => {
  it("weighs calories 70, protein 15, fitness 10, tasks 5", () => {
    const r = dailyScore({ calorie: 100, protein: { eaten: 60, target: 120 }, fitness: { done: 1, total: 2 }, tasks: { done: 0, total: 2 } });
    expect(r.points).toEqual({ calories: 70, protein: 8, fitness: 5, tasks: 0 });
    expect(r.score).toBe(83);
  });

  it("gives nothing extra for protein above the target", () => {
    const r = dailyScore({ calorie: 100, protein: { eaten: 300, target: 120 }, fitness: none, tasks: none });
    expect(r.points.protein).toBe(15);
    expect(r.score).toBe(100);
  });

  it("does not reward eating far below the target at the end of the day", () => {
    const low = dailyScore({ calorie: calorieScore(900, 2000), protein: null, fitness: none, tasks: none });
    const onTarget = dailyScore({ calorie: calorieScore(2000, 2000), protein: null, fitness: none, tasks: none });
    expect(low.points.calories).toBe(0);
    expect(onTarget.points.calories).toBe(70);
  });

  it("lowers the score for a big overshoot", () => {
    expect(dailyScore({ calorie: calorieScore(2600, 2000), protein: null, fitness: none, tasks: none }).points.calories).toBeLessThan(35);
  });

  it("scales over the parts that have data", () => {
    const r = dailyScore({ calorie: null, protein: null, fitness: { done: 1, total: 1 }, tasks: { done: 1, total: 1 } });
    expect(r.points.calories).toBeNull();
    expect(r.score).toBe(100);
  });
});

describe("dayMessage", () => {
  const base = { kcal: { eaten: 600, target: 2000 }, protein: { eaten: 20, target: 120 }, workout: none, tasks: none, activeMinutes: 0, score: 40 };

  it("asks for protein in the afternoon when it lags", () => {
    expect(dayMessage({ ...base, minutes: 14 * 60 }).text).toContain("חלבון");
  });

  it("says how many calories are left near the target", () => {
    expect(dayMessage({ ...base, minutes: 19 * 60, kcal: { eaten: 1800, target: 2000 }, protein: { eaten: 110, target: 120 } }).text).toContain("200");
  });

  it("suggests a lean protein when calories are almost gone and protein is short", () => {
    expect(dayMessage({ ...base, minutes: 18 * 60, kcal: { eaten: 1600, target: 2000 }, protein: { eaten: 50, target: 120 } }).text).toContain("טונה");
  });
});
