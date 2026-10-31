import { describe, expect, it } from "vitest";
import { dailyWaterTargetMl, fillSchedule, fillsForTarget, waterPace } from "./plan";

describe("daily water target", () => {
  it("scales with body weight and adds a bit on workout days", () => {
    expect(dailyWaterTargetMl({ weightKg: 70, workoutToday: false, medicalRestriction: false })).toBe(2100);
    expect(dailyWaterTargetMl({ weightKg: 70, workoutToday: true, medicalRestriction: false })).toBe(2600);
  });

  it("stays within a sensible range", () => {
    expect(dailyWaterTargetMl({ weightKg: 40, workoutToday: false, medicalRestriction: false })).toBe(1500);
    expect(dailyWaterTargetMl({ weightKg: 150, workoutToday: true, medicalRestriction: false })).toBe(3500);
    expect(dailyWaterTargetMl({ weightKg: null, workoutToday: false, medicalRestriction: false })).toBe(2000);
  });

  it("sets no target when there is a medical restriction", () => {
    expect(dailyWaterTargetMl({ weightKg: 70, workoutToday: true, medicalRestriction: true })).toBeNull();
  });
});

describe("fills and schedule", () => {
  it("counts fills of the user's own vessel, not fixed glasses", () => {
    expect(fillsForTarget(2100, 250)).toBe(9);
    expect(fillsForTarget(2100, 500)).toBe(5);
    expect(fillsForTarget(2100, 750)).toBe(3);
  });

  it("spreads fills evenly from waking until an hour before sleep", () => {
    expect(fillSchedule(5)).toEqual(["07:00", "10:30", "14:00", "17:30", "21:00"]);
    expect(fillSchedule(3, { wakeMin: 6 * 60, sleepMin: 23 * 60 })).toEqual(["06:00", "14:00", "22:00"]);
    expect(fillSchedule(1)).toEqual(["07:00"]);
  });
});

describe("pace", () => {
  const at = (h: number, m = 0) => h * 60 + m;

  it("is on track with one fill missing, behind with two", () => {
    // 5 bottles of 500 ml: 07:00, 10:30, 14:00, 17:30, 21:00
    expect(waterPace(500, 2500, 500, at(11)).status).toBe("on_track"); // 1 of 2 due
    expect(waterPace(0, 2500, 500, at(14, 30)).status).toBe("behind"); // 0 of 3 due
    expect(waterPace(1500, 2500, 500, at(12)).status).toBe("ahead");
  });

  it("points to the next fill and finishes the day", () => {
    const p = waterPace(1000, 2500, 500, at(12));
    expect(p.fillsDone).toBe(2);
    expect(p.nextAt).toBe("14:00");
    expect(waterPace(2500, 2500, 500, at(20)).status).toBe("done");
    expect(waterPace(2500, 2500, 500, at(20)).nextAt).toBeNull();
  });
});

describe("local day", async () => {
  const { localDay } = await import("./time");
  it("uses the Israel calendar date, not UTC", () => {
    // 22:30 UTC on Oct 31 is already Nov 1 in Israel (UTC+2 in winter).
    expect(localDay(new Date("2026-10-31T22:30:00Z"))).toEqual({ date: "2026-11-01", minutes: 30 });
    expect(localDay(new Date("2026-07-01T09:15:00Z"))).toEqual({ date: "2026-07-01", minutes: 12 * 60 + 15 });
  });
});
