/**
 * Water: a personal daily target spread across the waking day, logged one fill at a time.
 *
 * There is no fixed "8 glasses". The user picks the size of what they drink from (a glass,
 * a small or a large bottle) and taps +1 each time they finish one. The target and the
 * pacing are computed here, in code, never by the AI.
 *
 * Target: a common general guideline of about 30 ml per kg of body weight, plus extra on a
 * workout day, kept within a sensible range. When the safety screen reports a medical
 * restriction there is no target at all: fluid needs then follow the treating doctor.
 */

export const VESSEL_SIZES_ML = [250, 330, 500, 750, 1000] as const;
export const DEFAULT_VESSEL_ML = 250;

const ML_PER_KG = 30;
const WORKOUT_EXTRA_ML = 500;
const MIN_TARGET_ML = 1500;
const MAX_TARGET_ML = 3500;
const FALLBACK_TARGET_ML = 2000; // when weight is unknown

export interface WaterTargetInput {
  weightKg: number | null;
  workoutToday: boolean;
  /** Safety screen: a medical condition or restriction. No target is given then. */
  medicalRestriction: boolean;
}

/** Daily target in ml, rounded to 50 ml, or null when the app should not set one. */
export function dailyWaterTargetMl({ weightKg, workoutToday, medicalRestriction }: WaterTargetInput): number | null {
  if (medicalRestriction) return null;
  const base = weightKg && weightKg > 0 ? weightKg * ML_PER_KG : FALLBACK_TARGET_ML;
  const total = Math.min(MAX_TARGET_ML, Math.max(MIN_TARGET_ML, base + (workoutToday ? WORKOUT_EXTRA_ML : 0)));
  return Math.round(total / 50) * 50;
}

/** How many fills of the user's vessel make up the target. */
export function fillsForTarget(targetMl: number, vesselMl: number): number {
  return Math.max(1, Math.ceil(targetMl / vesselMl));
}

export interface WakingDay {
  /** Minutes after midnight, local time. Defaults: 07:00 to 22:00. */
  wakeMin?: number;
  sleepMin?: number;
}

const DEFAULT_WAKE = 7 * 60;
const DEFAULT_SLEEP = 22 * 60;

/**
 * Suggested times for each fill, spread evenly over the waking day. The last fill is due an
 * hour before sleep so that drinking does not pile up at night.
 */
export function fillSchedule(fills: number, { wakeMin = DEFAULT_WAKE, sleepMin = DEFAULT_SLEEP }: WakingDay = {}): string[] {
  const end = Math.max(wakeMin + 60, sleepMin - 60);
  if (fills <= 1) return [hhmm(wakeMin)];
  const step = (end - wakeMin) / (fills - 1);
  return Array.from({ length: fills }, (_, i) => hhmm(Math.round(wakeMin + i * step)));
}

export type PaceStatus = "ahead" | "on_track" | "behind" | "done";

export interface WaterPace {
  drankMl: number;
  targetMl: number;
  fillsDone: number;
  fillsTotal: number;
  /** Fills the user should have finished by now. */
  fillsExpected: number;
  status: PaceStatus;
  /** Suggested time of the next fill (HH:MM), or null when the day is done. */
  nextAt: string | null;
}

/**
 * Where the user stands right now. "behind" means more than one fill short of the pace, so a
 * single missed glass is not treated as falling behind.
 */
export function waterPace(
  drankMl: number,
  targetMl: number,
  vesselMl: number,
  nowMin: number,
  day: WakingDay = {},
): WaterPace {
  const fillsTotal = fillsForTarget(targetMl, vesselMl);
  const fillsDone = Math.floor(drankMl / vesselMl);
  const schedule = fillSchedule(fillsTotal, day);
  const due = schedule.filter((t) => toMin(t) <= nowMin).length;
  const base = { drankMl, targetMl, fillsDone, fillsTotal, fillsExpected: due };
  if (drankMl >= targetMl) return { ...base, status: "done", nextAt: null };
  const nextAt = schedule[Math.min(fillsDone, fillsTotal - 1)] ?? null;
  const status: PaceStatus = fillsDone > due ? "ahead" : due - fillsDone > 1 ? "behind" : "on_track";
  return { ...base, status, nextAt };
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
