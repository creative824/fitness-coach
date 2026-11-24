import { describe, expect, it } from "vitest";
import { MOVE_TASKS, minutesFor, smartTasks, tasksByIds, walkMinutes, type SmartTaskInput } from "./smart-tasks";

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
    // Two food tasks, never the generic "write everything down" or "sleep earlier".
    expect(t.filter((x) => !MOVE_TASKS.includes(x.kind))).toHaveLength(2);
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

  it("fits the goal: protein first for muscle, stretching for flexibility", () => {
    const muscle = smartTasks({ ...base, goals: ["muscle"], weightKg: 80, workoutToday: true, proteinTarget: 130, date: "2026-11-24" });
    expect(muscle.some((x) => x.kind === "protein_breakfast" || x.kind === "protein_lunch" || x.kind === "protein_half")).toBe(true);
    expect(muscle.some((x) => x.kind === "cooldown")).toBe(true);
    expect(smartTasks({ ...base, goals: ["flexibility"] })[0].kind).toBe("stretch");
    // No protein numbers when the safety screen hides them.
    expect(smartTasks({ ...base, goals: ["muscle"], hideNumbers: true, proteinTarget: 130 }).some((x) => x.kind === "protein_half")).toBe(false);
  });

  it("changes from day to day and avoids yesterday's tasks", () => {
    const days = ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"].map((date) => smartTasks({ ...base, experience: "intermediate", date }).map((x) => x.id).join());
    expect(new Set(days).size).toBeGreaterThan(1);
    const y = smartTasks({ ...base, date: "2026-11-23" });
    const today = smartTasks({ ...base, date: "2026-11-24", recent: y.map((x) => x.id) });
    const food = (ts: typeof y) => ts.filter((x) => !MOVE_TASKS.includes(x.kind)).map((x) => x.id);
    expect(food(today).some((id) => food(y).includes(id))).toBe(false);
  });

  it("gives no two tasks of the same kind", () => {
    const t = smartTasks({ ...base, workoutToday: true, date: "2026-11-24" });
    expect(new Set(t.map((x) => x.kind)).size).toBe(t.length);
  });

  it("counts added activities towards movement tasks", () => {
    const acts = [{ kind: "walk", min: 10 }, { kind: "run", min: 5 }, { kind: "yoga", min: 15 }];
    expect(minutesFor("walk", acts)).toBe(15);
    expect(minutesFor("brisk_walk", acts)).toBe(5);
    expect(minutesFor("stretch", acts)).toBe(15);
  });
});

describe("daily task pool (v2)", () => {
  const person: SmartTaskInput = { ...base, experience: "intermediate", activityLevel: "light", bmi: 29, proteinTarget: 120 };

  it("day 1 → a walk is done → day 2 brings new, relevant tasks", () => {
    const day1 = smartTasks({ ...person, date: "2026-11-24" });
    expect(day1.length).toBeLessThanOrEqual(4);
    const walk = day1.find((t) => t.kind === "walk" || t.kind === "brisk_walk");
    expect(walk).toBeTruthy();
    // The walk is logged: 30 minutes of walking cover it.
    expect(minutesFor(walk!.kind, [{ kind: "brisk_walk", min: 30 }])).toBeGreaterThanOrEqual(walk!.minutes!);
    const history = [{ given: day1.map((t) => t.id), done: [walk!.id] }];
    const day2 = smartTasks({ ...person, date: "2026-11-25", history });
    const repeated = day2.filter((t) => day1.some((d) => d.id === t.id));
    expect(repeated.length).toBeLessThan(day2.length / 2);
    expect(day2.length).toBeGreaterThanOrEqual(3);
    expect(day2.length).toBeLessThanOrEqual(4);
  });

  it("never offers what the day already shows as done", () => {
    const t = smartTasks({ ...person, date: "2026-11-24", satisfied: ["walk", "brisk_walk", "protein_breakfast"] });
    expect(t.some((x) => x.kind === "walk" || x.kind === "brisk_walk" || x.kind === "protein_breakfast")).toBe(false);
  });

  it("reacts to yesterday: over on calories → a drink swap or light dinner; low protein → protein first", () => {
    const over = smartTasks({ ...person, date: "2026-11-24", yesterday: { kcal: 2600, kcalTarget: 1900, protein: 110 } });
    expect(over.some((x) => x.kind === "swap_drink" || x.kind === "light_dinner")).toBe(true);
    const low = smartTasks({ ...person, goals: ["muscle"], date: "2026-11-24", yesterday: { kcal: 2400, kcalTarget: 2500, protein: 60 } });
    expect(low.filter((x) => x.kind.startsWith("protein")).length).toBe(2);
    expect(low[low.length - 2].why).toContain("אתמול");
  });

  it("no contradictions: one main movement, one protein task on a normal day, no squats on a legs day", () => {
    for (let d = 1; d <= 20; d++) {
      const t = smartTasks({ ...person, goals: ["muscle"], date: `2026-11-${String(d).padStart(2, "0")}`, workoutToday: false, workoutGroups: ["legs"] });
      expect(t.filter((x) => ["walk", "brisk_walk", "jog"].includes(x.kind)).length).toBeLessThanOrEqual(1);
      expect(t.filter((x) => x.kind.startsWith("protein")).length).toBeLessThanOrEqual(1);
      expect(t.some((x) => x.kind === "legs")).toBe(false);
      expect(new Set(t.map((x) => x.id)).size).toBe(t.length);
      expect(t.length).toBeLessThanOrEqual(4);
    }
  });

  it("keeps today's list as given, by id", () => {
    const t = smartTasks({ ...person, date: "2026-11-24" });
    expect(tasksByIds({ ...person, date: "2026-11-24" }, t.map((x) => x.id))).toEqual(t);
  });
});
