import { describe, expect, it } from "vitest";
import { minutesFor, smartTasks, walkMinutes, type SmartTaskInput } from "./smart-tasks";

const base: SmartTaskInput = {
  goals: ["lose_weight"],
  experience: "beginner",
  activityLevel: "sedentary",
  age: 40,
  bmi: 31,
  weightKg: 95,
  sleepHours: 7,
  lowIntensityOnly: false,
  needsDoctor: false,
  hideNumbers: false,
  workoutToday: false,
  weeksIn: 0,
};

describe("smart daily tasks", () => {
  it("gives a sedentary beginner who wants to lose weight a short walk", () => {
    const t = smartTasks(base);
    expect(t[0]).toMatchObject({ kind: "walk", minutes: 15 });
    expect(t.map((x) => x.kind)).toContain("log_food");
  });

  it("steps the walk up week by week, to a cap", () => {
    expect(walkMinutes({ ...base, weeksIn: 1 })).toBe(20);
    expect(walkMinutes({ ...base, weeksIn: 3 })).toBe(30);
    expect(walkMinutes({ ...base, weeksIn: 20 })).toBe(40);
    expect(walkMinutes({ ...base, bmi: 37, weeksIn: 20 })).toBe(35);
  });

  it("asks more of someone already active", () => {
    const t = smartTasks({ ...base, experience: "intermediate", activityLevel: "active", bmi: 26 });
    expect(t[0]).toMatchObject({ kind: "brisk_walk", minutes: 30 });
  });

  it("keeps it gentle when the health answers say so, and skips movement before a doctor's OK", () => {
    expect(walkMinutes({ ...base, lowIntensityOnly: true, weeksIn: 10 })).toBe(20);
    expect(smartTasks({ ...base, needsDoctor: true }).some((x) => x.minutes)).toBe(false);
  });

  it("shortens the walk on a workout day", () => {
    expect(walkMinutes({ ...base, activityLevel: "very_active", experience: "advanced", workoutToday: true })).toBe(15);
  });

  it("fits the goal: protein for muscle, stretching for flexibility, sleep when short", () => {
    const muscle = smartTasks({ ...base, goals: ["muscle"], weightKg: 80, workoutToday: true });
    expect(muscle.find((x) => x.kind === "protein")).toMatchObject({ grams: 130 });
    expect(smartTasks({ ...base, goals: ["flexibility"] })[0].kind).toBe("stretch");
    expect(smartTasks({ ...base, sleepHours: 6 }).some((x) => x.kind === "sleep")).toBe(true);
    // No calorie or protein numbers when the safety screen hides them.
    expect(smartTasks({ ...base, goals: ["muscle"], hideNumbers: true }).some((x) => x.kind === "protein")).toBe(false);
  });

  it("counts added activities towards movement tasks", () => {
    const acts = [{ kind: "walk", min: 10 }, { kind: "run", min: 5 }, { kind: "yoga", min: 15 }];
    expect(minutesFor("walk", acts)).toBe(15);
    expect(minutesFor("brisk_walk", acts)).toBe(5);
    expect(minutesFor("stretch", acts)).toBe(15);
  });
});
