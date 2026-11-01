/**
 * Progress maths (spec §13). Weight is shown as a trend, not as daily ups and downs:
 * one point per week, the average of that week's entries.
 */
import { weekStartOf } from "@/lib/plan/week";

export interface WeightEntry {
  date: string;
  weight_kg: number;
}

export interface WeekPoint {
  weekStart: string;
  avg: number;
  count: number;
}

export function weeklyAverages(entries: WeightEntry[]): WeekPoint[] {
  const byWeek = new Map<string, number[]>();
  for (const e of entries) {
    const k = weekStartOf(e.date);
    byWeek.set(k, [...(byWeek.get(k) ?? []), e.weight_kg]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, xs]) => ({ weekStart, count: xs.length, avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 }));
}

/** Change between the first and last weekly average, or null with fewer than two weeks. */
export function trendChange(points: WeekPoint[]): number | null {
  if (points.length < 2) return null;
  return Math.round((points[points.length - 1].avg - points[0].avg) * 10) / 10;
}

export interface DayScore {
  date: string;
  earned: number;
  possible: number;
  done: number;
  total: number;
}

/** Days on which at least half of the possible points were earned. Gentle: a weak day is not a failure. */
export function activeDays(days: DayScore[]): number {
  return days.filter((d) => d.possible > 0 && d.earned * 2 >= d.possible).length;
}
