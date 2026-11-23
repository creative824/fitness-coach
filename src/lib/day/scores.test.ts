import { describe, expect, it } from "vitest";
import { calorieScore, proteinTarget, taskScore, weekAverage } from "./scores";

describe("calorieScore", () => {
  it("is full within 10% of the target and falls to 0 at 40% off", () => {
    expect(calorieScore(1800, 1800)).toBe(100);
    expect(calorieScore(1950, 1800)).toBe(100);
    expect(calorieScore(1800 * 1.25, 1800)).toBe(50);
    expect(calorieScore(1800 * 1.5, 1800)).toBe(0);
    expect(calorieScore(1800 * 0.6, 1800)).toBe(0);
  });
  it("counts progress while the day is going", () => {
    expect(calorieScore(900, 1800, true)).toBe(50);
    expect(calorieScore(0, 1800, true)).toBe(0);
    expect(calorieScore(2600, 1800, true)).toBeLessThan(20);
  });
  it("has no score without a target or food", () => {
    expect(calorieScore(1500, null)).toBeNull();
    expect(calorieScore(null, 1800)).toBeNull();
  });
});

describe("proteinTarget", () => {
  it("follows the goal and the weight", () => {
    expect(proteinTarget(["muscle"], 75)).toBe(120);
    expect(proteinTarget(["lose_weight"], 92)).toBe(110);
    expect(proteinTarget(["general_fitness"], 66)).toBe(65);
    expect(proteinTarget(["muscle"], null)).toBeNull();
  });
});

describe("taskScore", () => {
  it("weights calories, protein and actions 30/30/40", () => {
    const r = taskScore({ calorie: 100, protein: { eaten: 60, target: 120 }, actions: { done: 3, total: 4 } });
    expect(r.parts).toEqual({ calories: 100, protein: 50, actions: 75 });
    expect(r.score).toBe(75);
  });
  it("leaves out parts with no data", () => {
    expect(taskScore({ calorie: null, protein: null, actions: { done: 1, total: 2 } }).score).toBe(50);
    expect(taskScore({ calorie: null, protein: null, actions: { done: 0, total: 0 } }).score).toBeNull();
  });
});

it("averages the days that have a score", () => {
  expect(weekAverage([80, null, 60])).toBe(70);
  expect(weekAverage([null])).toBeNull();
});

describe("countActions", async () => {
  const { countActions } = await import("./actions-count");
  it("counts exercises, ticked tasks, walks from activities and automatic ones", () => {
    const tasks = [
      { id: "walk", kind: "walk" as const, minutes: 20 },
      { id: "log", kind: "log_food" as const },
      { id: "sleep", kind: "sleep" as const },
    ];
    expect(countActions(tasks, 4, { done: ["ex:0", "ex:1", "t:sleep"], acts: [{ kind: "walk", min: 25 }] }, { meals: 3, protein: 50 })).toEqual({ done: 5, total: 7 });
    expect(countActions(tasks, 0, { done: [], acts: [] }, { meals: 1, protein: null })).toEqual({ done: 0, total: 3 });
  });
});
