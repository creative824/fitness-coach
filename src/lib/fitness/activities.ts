/**
 * General activities the user can add to the day ("walked 15 minutes"). Energy is a rough
 * estimate from MET values of the Compendium of Physical Activities (Ainsworth 2011):
 * kcal ≈ MET × body weight (kg) × hours.
 */
export const ACTIVITIES = {
  walk: { label: "הליכה", met: 3.5 },
  brisk_walk: { label: "הליכה מהירה", met: 4.8 },
  run: { label: "ריצה", met: 8.3 },
  bike: { label: "אופניים", met: 6.8 },
  swim: { label: "שחייה", met: 6 },
  stairs: { label: "עליית מדרגות", met: 8 },
  yoga: { label: "יוגה או מתיחות", met: 2.5 },
  dance: { label: "ריקוד", met: 5 },
  ball: { label: "משחק כדור", met: 7 },
  gym: { label: "חדר כושר", met: 5 },
} as const;

export type ActivityKind = keyof typeof ACTIVITIES;
export const ACTIVITY_KINDS = Object.keys(ACTIVITIES) as ActivityKind[];
export const MINUTE_CHOICES = [10, 15, 20, 30, 45, 60] as const;

export function activityKcal(kind: string, minutes: number, weightKg: number | null): number | null {
  const a = ACTIVITIES[kind as ActivityKind];
  if (!a || !weightKg) return null;
  return Math.round((a.met * weightKg * minutes) / 60 / 5) * 5;
}
