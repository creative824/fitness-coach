import { describe, expect, it } from "vitest";
import { calorieScore, proteinTarget } from "./scores";

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
    expect(proteinTarget(["lose_weight"], 92)).toBe(145);
    // High BMI: the weight at BMI 27 is used.
    expect(proteinTarget(["lose_weight"], 120, { heightCm: 170 })).toBe(125);
    expect(proteinTarget(["muscle"], 75, { activityLevel: "very_active" })).toBe(135);
    expect(proteinTarget(["general_fitness"], 66)).toBe(65);
    expect(proteinTarget(["muscle"], null)).toBeNull();
  });
});

