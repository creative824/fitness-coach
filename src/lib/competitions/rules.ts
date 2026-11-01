/**
 * Competition kinds and their formulas, shown to everyone before they join (spec §3, §5).
 * The database computes the scores (supabase/migrations/0008_competitions.sql); this file only
 * describes them. Keep the two in step.
 */
export const KINDS = ["consistency", "habits", "water"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_INFO: Record<Kind, { title: string; short: string; formula: string }> = {
  consistency: {
    title: "התמדה באימונים",
    short: "מי שמשלים את האימונים שבתוכנית שלו",
    formula:
      "הציון הוא אחוז האימונים שהושלמו מתוך האימונים שבתוכנית האישית של כל אחד, מיום ההצטרפות ועד הסוף. מי שמתאמן 3 פעמים בשבוע ומשלים הכול שווה למי שמתאמן 5 ומשלים הכול. מינימום של 2 אימונים בשבוע בחישוב.",
  },
  habits: {
    title: "הרגלים יומיים",
    short: "כל המשימות היומיות: אימון, ארוחות, מים, שינה",
    formula:
      "הציון הוא אחוז המשימות היומיות שהושלמו מתוך המשימות שבתוכנית האישית. בחישוב יש לפחות 3 משימות ליום, כך שתוכנית מצומצמת לא נותנת יתרון.",
  },
  water: {
    title: "שתייה",
    short: "מי שמגיע ליעד המים האישי שלו",
    formula: "הציון הוא אחוז הימים שבהם הגעת ליעד המים האישי שלך. אין בונוס על שתייה מעבר ליעד.",
  },
};

export const SHARED_RULES = [
  "רואים רק כינויים ואת הציון של התחרות. משקל, יומן אוכל ומידע בריאותי לא משותפים.",
  "אפשר לסמן משימה רק ביום שלה או למחרת. אין ניקוד על אכילה מועטה, צום או אימון מעבר לתוכנית.",
  "בסיום: מקום ראשון 100 נקודות, שני 60, שלישי 30. בתיקו מחלקים. מי שלא השלים כלום לא מקבל פרס.",
];

export const PRIZES = [100, 60, 30];
export const MAX_MEMBERS = 20;
export const DURATIONS = [7, 14, 30] as const;

export type Status = "upcoming" | "active" | "ended" | "cancelled";

export function statusOf(
  b: {
    start_date: string;
    end_date: string;
    cancelled_at: string | null;
    finalized_at: string | null;
  },
  today: string,
): Status {
  if (b.cancelled_at) return "cancelled";
  if (b.finalized_at || b.end_date < today) return "ended";
  if (b.start_date > today) return "upcoming";
  return "active";
}

export const STATUS_LABEL: Record<Status, string> = {
  upcoming: "טרם התחילה",
  active: "פעילה",
  ended: "הסתיימה",
  cancelled: "בוטלה",
};

/** Whole days from `today` to `date`, both YYYY-MM-DD. */
export function daysBetween(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function timeLeftLabel(b: { start_date: string; end_date: string }, status: Status, today: string): string | null {
  if (status === "upcoming") {
    const d = daysBetween(today, b.start_date);
    return d === 1 ? "מתחילה מחר" : `מתחילה בעוד ${d} ימים`;
  }
  if (status === "active") {
    const d = daysBetween(today, b.end_date);
    return d === 0 ? "היום האחרון" : d === 1 ? "נשאר יום אחד" : `נשארו ${d} ימים`;
  }
  return null;
}
