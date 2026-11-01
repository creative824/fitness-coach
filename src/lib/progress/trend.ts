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

export interface WeekSummary {
  total: number;
  possible: number;
  /** Average points per day, over the days so far that had tasks. */
  average: number;
  activeDays: number;
  /** Days in a row, up to today, with at least one completed task. */
  streak: number;
  /** Days so far that had tasks. */
  countedDays: number;
}

/** Weekly summary (follow-up spec §8). Future days are not counted, so the week is never "behind". */
export function summarizeWeek(days: { date: string; earned: number; possible: number }[], today: string): WeekSummary {
  const sofar = days.filter((d) => d.date <= today && d.possible > 0);
  const total = sofar.reduce((s, d) => s + d.earned, 0);
  let streak = 0;
  for (const d of [...days].filter((x) => x.date <= today).reverse()) {
    if (d.earned > 0) streak += 1;
    else if (d.date === today) continue; // today may still be in progress
    else break;
  }
  return {
    total,
    possible: sofar.reduce((s, d) => s + d.possible, 0),
    average: sofar.length ? Math.round(total / sofar.length) : 0,
    activeDays: activeDays(sofar.map((d) => ({ ...d, done: 0, total: 0 }))),
    streak,
    countedDays: sofar.length,
  };
}

/**
 * A positive comparison with the week before, or null. Shown only with enough data on both
 * sides (at least 3 days each), and never as a drop: a weaker week gets no comparison line.
 */
export function compareWeeks(current: WeekSummary, previous: WeekSummary): string | null {
  if (current.countedDays < 3 || previous.countedDays < 3) return null;
  const diff = current.average - previous.average;
  if (diff >= 3) return `בממוצע ${diff} נקודות יותר ביום מהשבוע שעבר. יפה!`;
  if (current.activeDays > previous.activeDays) return `${current.activeDays - previous.activeDays} ימים פעילים יותר מהשבוע שעבר.`;
  if (Math.abs(diff) < 3) return "שבוע יציב, בקצב דומה לשבוע שעבר.";
  return null;
}
