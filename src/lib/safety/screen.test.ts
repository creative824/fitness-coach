import { describe, expect, it } from "vitest";
import { allowedGoals, screenSafety, type SafetyInput } from "./screen";

const base: SafetyInput = {
  answers: {
    medical_condition: false,
    pregnancy: false,
    active_injury: false,
    chest_pain: false,
    fainting: false,
    eating_disorder: false,
    medical_restriction: false,
  },
  goals: ["general_fitness"],
  height_cm: 170,
  weight_kg: 70,
  target_weight_kg: null,
};

const withAnswer = (k: keyof SafetyInput["answers"]): SafetyInput => ({ ...base, answers: { ...base.answers, [k]: true } });

describe("screenSafety", () => {
  it("is clear when every answer is no", () => {
    const r = screenSafety(base);
    expect(r.level).toBe("clear");
    expect(r.reasons).toEqual([]);
    expect(Object.values(r.restrictions).every((v) => v === false)).toBe(true);
  });

  it("refers chest pain on exertion and blocks workouts", () => {
    const r = screenSafety(withAnswer("chest_pain"));
    expect(r.level).toBe("refer");
    expect(r.restrictions.noWorkouts).toBe(true);
    expect(r.restrictions.noCalorieTarget).toBe(true);
  });

  it("refers fainting or dizziness", () => {
    expect(screenSafety(withAnswer("fainting")).level).toBe("refer");
  });

  it("never sets a calorie target or weight-loss goal with an eating disorder", () => {
    const r = screenSafety({ ...withAnswer("eating_disorder"), goals: ["lose_weight", "strength"] });
    expect(r.level).toBe("caution");
    expect(r.restrictions.noCalorieTarget).toBe(true);
    expect(r.restrictions.hideWeightTracking).toBe(true);
    expect(allowedGoals(["lose_weight", "strength"], r)).toEqual(["strength"]);
  });

  it("puts pregnancy on a gentle path with no calorie target", () => {
    const r = screenSafety(withAnswer("pregnancy"));
    expect(r.level).toBe("caution");
    expect(r.restrictions.lowIntensityOnly).toBe(true);
    expect(r.restrictions.noCalorieTarget).toBe(true);
    expect(r.restrictions.noWorkouts).toBe(false);
  });

  it("keeps workouts but lowers intensity for an active injury", () => {
    const r = screenSafety(withAnswer("active_injury"));
    expect(r.level).toBe("caution");
    expect(r.restrictions.lowIntensityOnly).toBe(true);
    expect(r.restrictions.noWorkouts).toBe(false);
  });

  it("drops weight loss when BMI is already below 18.5", () => {
    const r = screenSafety({ ...base, weight_kg: 50, goals: ["lose_weight"] }); // BMI 17.3
    expect(r.reasons).toContain("low_bmi_weight_loss");
    expect(allowedGoals(["lose_weight"], r)).toEqual([]);
  });

  it("flags a target weight below the healthy range", () => {
    const r = screenSafety({ ...base, target_weight_kg: 50, goals: ["lose_weight"] });
    expect(r.reasons).toContain("target_below_healthy_range");
    expect(r.restrictions.noWeightLossGoal).toBe(true);
  });

  it("refer outranks caution when both apply", () => {
    const r = screenSafety({ ...base, answers: { ...base.answers, chest_pain: true, pregnancy: true } });
    expect(r.level).toBe("refer");
    expect(r.reasons).toEqual(expect.arrayContaining(["chest_pain", "pregnancy"]));
  });
});
