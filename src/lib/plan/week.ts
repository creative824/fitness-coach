/**
 * Calendar helpers for the plan week. Weeks run Sunday to Saturday (Israel).
 * Dates are plain YYYY-MM-DD strings in the user's local calendar; arithmetic is done in UTC
 * so daylight-saving changes never shift a day.
 */

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The Sunday that starts the week containing `date`. */
export function weekStartOf(date: string): string {
  return addDays(date, -weekdayOf(date));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
