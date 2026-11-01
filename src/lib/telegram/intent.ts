/**
 * What a Telegram message asks for (follow-up spec §9). Plain rules for the fixed phrases;
 * anything else is treated as a meal report and goes to the food estimate.
 */

export type Intent =
  | { kind: "link"; code: string }
  | { kind: "start" }
  | { kind: "help" }
  | { kind: "unlink" }
  | { kind: "remaining" }
  | { kind: "calories" }
  | { kind: "water"; ml: number }
  | { kind: "activity"; minutes: number; activity: "walk" | "run" | "workout" | "other"; label: string }
  | { kind: "food"; text: string };

/** Link codes: 8 characters with no look-alikes (no 0/O, 1/I/L). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE = new RegExp(`^[${CODE_ALPHABET}]{8}$`);

const clean = (s: string) => s.replace(/[‎‏‪-‮]/g, "").trim();

function number(s: string): number | null {
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (m) return Number(m[1].replace(",", "."));
  const word = (w: string) => new RegExp(`(?:^|\\s)(?:${w})(?=\\s|$)`).test(s);
  if (word("חצי")) return 0.5;
  if (word("שתי|שני|שתיים|שניים|זוג")) return 2;
  if (word("שלוש|שלושה")) return 3;
  if (word("אחת|אחד")) return 1;
  return null;
}

/** Millilitres from "500 מ״ל", "ליטר וחצי", "2 כוסות", "בקבוק". Null when it is not about water. */
export function parseWater(s: string, vesselMl = 250): number | null {
  if (!/(שתיתי|^מים|\bמים\b|כוס(?:ות)? מים|בקבוק)/.test(s)) return null;
  const n = number(s);
  let ml: number | null = null;
  if (/מ["״']?ל|\bml\b|מיליליטר/i.test(s)) ml = n;
  else if (/ליטר וחצי/.test(s)) ml = 1500;
  else if (/חצי ליטר/.test(s)) ml = 500;
  else if (/ליטר/.test(s)) ml = (n ?? 1) * 1000;
  else if (/כוס/.test(s)) ml = (n ?? 1) * vesselMl;
  else if (/בקבוק/.test(s)) ml = (n ?? 1) * 500;
  else if (n !== null && n >= 50) ml = n;
  if (ml === null || !/מים|שתיתי/.test(s)) return null;
  return Math.round(ml);
}

function parseActivity(s: string): Extract<Intent, { kind: "activity" }> | null {
  if (!/(עשיתי|הלכתי|רצתי|התאמנתי|סיימתי|הליכה|ריצה|אימון|רכבתי|שחיתי|יוגה)/.test(s)) return null;
  let minutes: number | null = null;
  const m = s.match(/(\d+)\s*(?:דק(?:ות|ה|׳|')?|min)/);
  if (m) minutes = Number(m[1]);
  else if (/שעה וחצי/.test(s)) minutes = 90;
  else if (/חצי שעה/.test(s)) minutes = 30;
  else if (/רבע שעה/.test(s)) minutes = 15;
  else if (/שעתיים/.test(s)) minutes = 120;
  else if (/שעה/.test(s)) minutes = 60;
  if (minutes === null && !/התאמנתי|סיימתי (?:את )?(?:ה)?אימון/.test(s)) return null;
  const activity = /הלכתי|הליכה/.test(s) ? "walk" : /רצתי|ריצה/.test(s) ? "run" : /התאמנתי|אימון/.test(s) ? "workout" : "other";
  const label = { walk: "הליכה", run: "ריצה", workout: "אימון", other: "פעילות" }[activity];
  return { kind: "activity", minutes: Math.min(minutes ?? 0, 600), activity, label };
}

export function parseIntent(raw: string, vesselMl?: number): Intent {
  const s = clean(raw);
  const start = s.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/i);
  if (start) {
    const code = start[1]?.toUpperCase();
    return code && CODE.test(code) ? { kind: "link", code } : { kind: "start" };
  }
  if (CODE.test(s.toUpperCase().replace(/\s|-/g, "")) && /^[\sA-Za-z0-9-]+$/.test(s)) return { kind: "link", code: s.toUpperCase().replace(/\s|-/g, "") };
  if (/^\/help\b|^עזרה$|^\?$/.test(s)) return { kind: "help" };
  if (/^\/unlink\b|^נתק(?: את)?(?: הבוט| טלגרם)?$/.test(s)) return { kind: "unlink" };
  if (/^\/today\b|מה נשאר|מה עוד יש לי|מה יש לי היום/.test(s)) return { kind: "remaining" };
  if (/^\/calories\b|כמה קלוריות|קלוריות (?:אכלתי )?היום/.test(s)) return { kind: "calories" };
  const ml = parseWater(s, vesselMl);
  if (ml !== null) return { kind: "water", ml };
  const act = parseActivity(s);
  if (act) return act;
  return { kind: "food", text: s.replace(/^(אכלתי|אכלנו|שתיתי)\s+/, "").slice(0, 1000) || s };
}
