import { describe, expect, it } from "vitest";
import { screenSafety } from "@/lib/safety/screen";
import { calorieTarget, type TargetInput } from "./targets";

const safety = screenSafety({ answers: {}, goals: ["lose_weight"], height_cm: 178, weight_kg: 85, target_weight_kg: 75 });
const base: TargetInput = {
  age: 35,
  heightCm: 178,
  weightKg: 85,
  sex: "male",
  activityLevel: "light",
  goals: ["lose_weight"],
  experience: "beginner",
  availableDays: [0, 2, 4],
  safety,
  targetWeightKg: 75,
  today: "2026-01-01",
};

describe("goal pace", () => {
  it("accepts 10 kg in 4 months and plans the deficit for the date", () => {
    const c = calorieTarget({ ...base, targetDate: "2026-05-01" })!;
    expect(c.pace?.tooFast).toBe(false);
    expect(c.kgPerWeek).toBeLessThan(0);
    expect(c.bmr).toBeGreaterThan(1700);
    expect(c.pace?.etaDate).toBeTruthy();
  });

  it("flags 10 kg in one month as too fast and keeps the deficit healthy", () => {
    const c = calorieTarget({ ...base, targetDate: "2026-02-01" })!;
    expect(c.pace?.tooFast).toBe(true);
    expect(c.pace!.recommendedDate > "2026-02-01").toBe(true);
    // Never more than 1% of body weight a week, nor a quarter of daily use.
    expect(-c.kgPerWeek).toBeLessThanOrEqual(0.85 + 0.01);
    expect(-c.adjust).toBeLessThanOrEqual(c.maintenance * 0.25 + 50);
  });

  it("works without a date, with a moderate pace", () => {
    const c = calorieTarget({ ...base, targetDate: null })!;
    expect(c.pace?.tooFast).toBe(false);
    expect(c.pace?.recommendedDate).toMatch(/^2026-/);
    expect(c.adjust).toBeLessThan(0);
  });
});
