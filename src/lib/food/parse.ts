/**
 * Estimates calories from free Hebrew text ("2 פרוסות לחם מלא עם חביתה וקפה הפוך") without AI,
 * using the food database in src/content/food-db.ts. Pure and synchronous: it runs in the
 * browser while the user types, and on the server.
 *
 * How it reads the text:
 * - Foods are matched by their longest name ("לחם מלא" before "לחם"), with Hebrew prefixes
 *   (ו, ה, ב, ל, מ, ש, כ and pairs like "וה") stripped from the first word.
 * - A number or number word ("2", "שתי", "חצי", "1.5", "½") and a unit ("פרוסות", "כף", "גרם",
 *   "כוס", "פחית"...) before a food set its amount. A number after a food ("ביצים 2", "אורז 200
 *   גרם") sets it too, when no other food follows. "וחצי" adds a half.
 * - "גדול" / "קטן" scale the portion, "מטוגן" switches to the fried food or adds the oil,
 *   "בלי" / "ללא" skips the next food ("קפה בלי סוכר").
 * - Without an amount, the food's typical portion is used and the estimate is marked less sure.
 * - Words that are not food, amounts or filler come back in `unknown`, so the app can say what
 *   it did not recognise (and optionally ask the AI about just those words).
 */
import { FOOD_DB, type DbFood } from "@/content/food-db";
import type { FoodItem } from "./items";

export interface ParsedItem extends FoodItem {
  foodId: string;
  grams: number;
  kcal: number;
  /** Whether the amount came from the text (true) or is the typical portion (false). */
  explicit: boolean;
  /** The unit the amount is counted in (pc, slice, cup, g...). */
  unitKey: string;
}

export interface ParseResult {
  items: ParsedItem[];
  unknown: string[];
  kcal: number;
}

// ───────────────────────── text normalisation ─────────────────────────

const QUOTES = /['"׳״`’‘”“]/g;
const NIQQUD = /[֑-ׇ]/g;

export function normalize(text: string): string {
  return text
    .replace(NIQQUD, "")
    .replace(QUOTES, "")
    .toLowerCase()
    .replace(/½/g, " 0.5 ")
    .replace(/¼/g, " 0.25 ")
    .replace(/¾/g, " 0.75 ")
    .replace(/⅓/g, " 0.33 ")
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => ` ${Math.round((Number(a) / Number(b)) * 100) / 100} `)
    .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g, (_, a, b) => ` ${(Number(a) + Number(b)) / 2} `)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)([^\d\s.])/g, "$1 $2")
    .replace(/([^\d\s.])(\d)/g, "$1 $2")
    .replace(/[,;+\n\r\t()!?:|/\\]+/g, " , ")
    .replace(/(^|[^\d])\.|\.(?!\d)/g, "$1 , ")
    .replace(/%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

// ───────────────────────── vocabularies ─────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  אחד: 1, אחת: 1, שני: 2, שתי: 2, שניים: 2, שתיים: 2, שנים: 2, זוג: 2, שלוש: 3, שלושה: 3, שלושת: 3,
  ארבע: 4, ארבעה: 4, ארבעת: 4, חמש: 5, חמישה: 5, חמשת: 5, שש: 6, שישה: 6, ששת: 6, שבע: 7, שבעה: 7,
  שבעת: 7, שמונה: 8, שמונת: 8, תשע: 9, תשעה: 9, תשעת: 9, עשר: 10, עשרה: 10, עשרת: 10, עשרים: 20,
  תריסר: 12, חצי: 0.5, רבע: 0.25, שליש: 0.33,
};

type UnitKey = "pc" | "slice" | "tbsp" | "tsp" | "cup" | "bowl" | "plate" | "serving" | "can" | "bottle" | "handful" | "bag" | "square" | "row" | "bar" | "triangle" | "ball" | "scoop" | "tray" | "shot" | "g" | "kg" | "ml" | "l";

const UNIT_WORDS: Record<string, UnitKey> = {};
const addUnits = (key: UnitKey, words: string) => words.split(" ").forEach((w) => (UNIT_WORDS[w] = key));
addUnits("pc", "יחידה יחידות יח חתיכה חתיכות חתיכת");
addUnits("slice", "פרוסה פרוסות פרוסת");
addUnits("tbsp", "כף כפות");
addUnits("tsp", "כפית כפיות כפיית");
addUnits("cup", "כוס כוסות ספל ספלים גביע גביעים גביעי");
addUnits("bowl", "קערה קערות קערת קערית קעריות");
addUnits("plate", "צלחת צלחות");
addUnits("serving", "מנה מנות מנת פורציה");
addUnits("can", "פחית פחיות קופסה קופסת קופסא קופסאות קופסאת");
addUnits("bottle", "בקבוק בקבוקים בקבוקון בקבוקי");
addUnits("handful", "חופן חופנים קומץ");
addUnits("bag", "שקית שקיות חבילה חבילת חבילות");
addUnits("square", "קוביה קוביות קוביית ריבוע ריבועים");
addUnits("row", "שורה שורות שורת");
addUnits("bar", "חפיסה חפיסות חפיסת");
addUnits("triangle", "משולש משולשים");
addUnits("ball", "כדור כדורים");
addUnits("scoop", "סקופ סקופים מצקת");
addUnits("tray", "מגש מגשים");
addUnits("shot", "כוסית כוסיות");
addUnits("g", "גרם גרמים גר ג g gr gram grams");
addUnits("kg", "קילו קג kg");
addUnits("ml", "מל ml מיליליטר");
addUnits("l", "ליטר ליטרים l");

/** Fallback grams when a food has no weight for the unit used. */
const GENERIC: Partial<Record<UnitKey, number>> = { tbsp: 15, tsp: 5, cup: 240, bowl: 300, plate: 350, handful: 30, bag: 50, shot: 40, scoop: 30, ball: 65 };

const UNIT_LABEL: Record<string, [string, string]> = {
  pc: ["יחידה", "יחידות"],
  slice: ["פרוסה", "פרוסות"],
  tbsp: ["כף", "כפות"],
  tsp: ["כפית", "כפיות"],
  cup: ["כוס", "כוסות"],
  bowl: ["קערה", "קערות"],
  plate: ["צלחת", "צלחות"],
  serving: ["מנה", "מנות"],
  can: ["קופסה", "קופסאות"],
  bottle: ["בקבוק", "בקבוקים"],
  handful: ["חופן", "חופנים"],
  bag: ["שקית", "שקיות"],
  square: ["קוביה", "קוביות"],
  row: ["שורה", "שורות"],
  bar: ["חפיסה", "חפיסות"],
  triangle: ["משולש", "משולשים"],
  ball: ["כדור", "כדורים"],
  scoop: ["סקופ", "סקופים"],
  tray: ["מגש", "מגשים"],
  shot: ["כוסית", "כוסיות"],
  g: ["גרם", "גרם"],
  ml: ["מ״ל", "מ״ל"],
};

const SIZE: Record<string, number> = {
  גדול: 1.35, גדולה: 1.35, גדולים: 1.35, גדולות: 1.35, ענק: 1.7, ענקית: 1.7, ענקיים: 1.7, כפולה: 2, כפול: 2,
  קטן: 0.7, קטנה: 0.7, קטנים: 0.7, קטנות: 0.7, בינוני: 1, בינונית: 1, בינוניים: 1, מלאה: 1, גדושה: 1.4, גדושות: 1.4,
};

const FRIED = new Set(["מטוגן", "מטוגנת", "מטוגנים", "מטוגנות", "בטיגון", "מוקפץ", "מוקפצים", "מוקפצת", "פריך", "פריכים"]);
const NEGATE = new Set(["בלי", "ללא", "בלא", "חוץ"]);
const WITH = new Set(["עם", "ועם", "בתוספת", "ובתוספת", "ותוספת", "תוספת"]);
const HALF_MORE = new Set(["וחצי"]);

/** Fried versions of foods. Other foods get about 6 g of absorbed oil per 100 g. */
const FRIED_OF: Record<string, string> = { potato: "fries", potato_boiled: "fries", egg: "egg_fried", fish: "fish_fried", eggplant: "eggplant_fried", chicken_breast: "schnitzel", veg: "veg_stir", veg_cooked: "veg_stir" };

/** Words that carry no food and no amount. They are skipped and never reported as unknown. */
const FILLER = new Set(
  `אכלתי אכלנו אכל אכלה שתיתי שתינו שתה שתתה נשנשתי טעמתי לקחתי הכנתי היה היו היום אתמול הבוקר הערב בבוקר בצהריים בצהרים בערב בלילה
  ארוחת ארוחה ארוחות בוקר צהריים צהרים ערב לילה ביניים נשנוש נשנושים וגם גם עוד ועוד של שלי שלה שלו את אני הוא היא קצת מעט בערך כ בסביבות
  איזה איזו משהו כזה כזאת כאלה ואז אז אחר כך אחרי לפני על בתוך ממש כמה טעים טעימה טעימים מאוד לבד בבית במסעדה מסעדה בעבודה מהתפריט יחד ביחד
  בשביל טרי טרייה טריים טריות ביתי ביתית ביתיים קנוי קנויה חם חמה חמים קר קרה קרים מבושל מבושלת מבושלים מבושלות אפוי אפויה אפויים אפויות צלוי צלויה
  צלויים בגריל בתנור מאודה מאודים קלוי קלויה קלויים טבעי טבעית רגיל רגילה רגילים דל דלה מלוח מלוחה מתוק מתוקה פרוס פרוסים קצוץ קצוצה קצוצים
  ו ה ב ל מ ש כ או וגם בנוסף כולל כוללת מלא חתוך חתוכה חתוכים שלם שלמה שלמים בערך-ב קטנטן עליו עליה עליהם מעל בצד ליד ועליו והייתה היתה
  ואחר שוב פעם פעמיים`.split(/\s+/),
);

const PREFIXES = ["", "ו", "ה", "ב", "ל", "מ", "ש", "כ", "וה", "וב", "ול", "ומ", "וש", "וכ", "שה", "מה", "בה", "לה", "כש", "שב", "של", "וי"];

// ───────────────────────── name index ─────────────────────────

const norm = (s: string) => normalize(s);
interface NameEntry {
  words: string[];
  food: DbFood;
  /** The name as written in the database, shown to the user. */
  label: string;
}
const BY_FIRST = new Map<string, NameEntry[]>();
const BY_ID = new Map<string, DbFood>();
const NAME_OWNER = new Map<string, string>();
for (const food of FOOD_DB) for (const name of food.he) NAME_OWNER.set(norm(name), food.id);
for (const food of FOOD_DB) {
  BY_ID.set(food.id, food);
  for (const name of food.he) {
    const words = norm(name).split(" ");
    // "פרוסות לחם", "כוס תה": the unit word is read as a unit, so "2 פרוסות לחם" counts slices.
    // Kept when the rest means another food ("סקופ חלבון" is not egg white).
    if (words.length > 1 && words[0] in UNIT_WORDS && NAME_OWNER.get(words.slice(1).join(" ")) === food.id) continue;
    const list = BY_FIRST.get(words[0]) ?? [];
    list.push({ words, food, label: name });
    BY_FIRST.set(words[0], list);
  }
}
for (const list of BY_FIRST.values()) list.sort((a, b) => b.words.length - a.words.length);

export const foodById = (id: string) => BY_ID.get(id);

/** Strips a Hebrew prefix when the rest is a known word, e.g. "והלחם" → "לחם". */
function stripped(token: string, known: (t: string) => boolean): string | null {
  for (const p of PREFIXES) {
    if (p && !token.startsWith(p)) continue;
    const rest = token.slice(p.length);
    if (rest.length >= 2 && known(rest)) return rest;
  }
  return null;
}

function matchFood(tokens: string[], i: number): { food: DbFood; len: number; label: string } | null {
  const t = tokens[i];
  for (const p of PREFIXES) {
    if (p && !t.startsWith(p)) continue;
    const first = t.slice(p.length);
    if (first.length < 2) continue;
    const list = BY_FIRST.get(first);
    if (!list) continue;
    for (const e of list) {
      let ok = true;
      for (let k = 1; k < e.words.length; k++) {
        const w = tokens[i + k];
        if (w === undefined || (w !== e.words[k] && !(w.length > 2 && w.startsWith("ה") && w.slice(1) === e.words[k]))) {
          ok = false;
          break;
        }
      }
      if (ok) return { food: e.food, len: e.words.length, label: e.label };
    }
  }
  return null;
}

const numberOf = (t: string): number | null => {
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t in NUMBER_WORDS) return NUMBER_WORDS[t];
  const s = stripped(t, (r) => r in NUMBER_WORDS);
  return s ? NUMBER_WORDS[s] : null;
};
const unitOf = (t: string): UnitKey | null => UNIT_WORDS[t] ?? (stripped(t, (r) => r in UNIT_WORDS) ? UNIT_WORDS[stripped(t, (r) => r in UNIT_WORDS)!] : null);
const sizeOf = (t: string): number | null => SIZE[t] ?? null;

// ───────────────────────── amounts ─────────────────────────

/** Units tried, in order, when the text gives a bare count ("2 ביצים", "חצי פיתה"). */
const COUNT_UNITS = ["pc", "slice", "triangle", "can", "bottle", "cup", "bowl", "serving", "ball", "scoop"];

function gramsFor(food: DbFood, unit: UnitKey | null, qty: number | null): { grams: number; unit: string; qty: number } {
  if (unit === "g" || unit === "ml") return { grams: qty ?? 100, unit, qty: qty ?? 100 };
  if (unit === "kg" || unit === "l") return { grams: (qty ?? 1) * 1000, unit: unit === "kg" ? "g" : "ml", qty: (qty ?? 1) * 1000 };
  if (unit) {
    const per = food.u[unit] ?? (unit === "plate" ? (food.u.bowl ?? food.u.serving) : undefined) ?? (unit === "bar" ? food.u.pc : undefined) ?? GENERIC[unit] ?? food.u[food.d[0]]!;
    return { grams: per * (qty ?? 1), unit, qty: qty ?? 1 };
  }
  if (qty !== null) {
    // A big bare number is grams ("200 אורז"), a small one is a count.
    if (qty >= 20 && !food.u.pc) return { grams: qty, unit: food.x?.includes("drink") ? "ml" : "g", qty };
    const u = COUNT_UNITS.find((k) => food.u[k]) ?? food.d[0];
    return { grams: food.u[u]! * qty, unit: u, qty };
  }
  const [u, q] = food.d;
  return { grams: food.u[u]! * q, unit: u, qty: q };
}

const fmtQty = (q: number) => {
  const r = Math.round(q * 100) / 100;
  if (r === 0.5) return "½";
  if (r % 1 === 0.5) return `${Math.floor(r)}½`;
  return String(r);
};

function unitLabel(unit: string, qty: number, food: DbFood): string {
  if (unit === "can" && food.x?.includes("drink")) return qty > 1 ? "פחיות" : "פחית";
  const l = UNIT_LABEL[unit];
  if (!l) return "";
  return qty > 1 ? l[1] : l[0];
}

// ───────────────────────── the parser ─────────────────────────

interface Draft {
  food: DbFood;
  label: string;
  qty: number | null;
  unit: UnitKey | null;
  size: number;
  fried: boolean;
  addonOf: DbFood | null;
}

export function parseFood(text: string): ParseResult {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const drafts: Draft[] = [];
  const unknown: string[] = [];
  let unknownRun: string[] = [];
  const flushUnknown = () => {
    if (unknownRun.length) unknown.push(unknownRun.join(" "));
    unknownRun = [];
  };

  let pendingQty: number | null = null;
  let pendingUnit: UnitKey | null = null;
  let pendingSize = 1;
  let negate = false;
  let withNext = false;
  let lastFried = false;
  /** The previous token closed a food (or its unit), so a number right here may be its amount. */
  let afterFood: boolean = false;

  const resetPending = () => {
    pendingQty = null;
    pendingUnit = null;
    pendingSize = 1;
  };

  /** Is there a food within the next few tokens (past units, sizes and "של")? */
  const foodAhead = (from: number) => {
    for (let k = from; k < Math.min(tokens.length, from + 4); k++) {
      const t = tokens[k];
      if (matchFood(tokens, k)) return true;
      if (t === "," || WITH.has(t)) return false;
      if (unitOf(t) || sizeOf(t) || t === "של" || HALF_MORE.has(t) || numberOf(t) !== null) continue;
      return false;
    }
    return false;
  };

  /** "ביצים 2 וטוסט": after the number (and a unit) comes the end, a comma, "עם" or a "ו" + food. */
  const closesPrevious = (from: number) => {
    let k = from;
    if (tokens[k] && unitOf(tokens[k])) k++;
    const next = tokens[k];
    if (next === undefined || next === "," || WITH.has(next)) return true;
    return next.startsWith("ו") && matchFood(tokens, k) !== null && !BY_FIRST.has(next);
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const wasAfterFood: boolean = afterFood;
    afterFood = false;

    if (t === ",") {
      flushUnknown();
      resetPending();
      negate = false;
      withNext = false;
      continue;
    }

    const m = matchFood(tokens, i);
    if (m) {
      flushUnknown();
      const prev = drafts[drafts.length - 1];
      if (negate) {
        negate = false;
        resetPending();
        i += m.len - 1;
        continue;
      }
      // "מטוגן בשמן": the oil is already counted by "fried".
      if (lastFried && (m.food.id === "olive_oil" || m.food.id === "canola_oil") && pendingQty === null) {
        lastFried = false;
        i += m.len - 1;
        continue;
      }
      // "נס קפה עם חלב": the milk is already in the drink.
      if (withNext && prev?.food.x?.includes("milky") && (m.food.id === "milk" || m.food.id === "milk_low")) {
        withNext = false;
        i += m.len - 1;
        continue;
      }
      drafts.push({ food: m.food, label: m.label, qty: pendingQty, unit: pendingUnit, size: pendingSize, fried: false, addonOf: withNext ? (prev?.food ?? null) : null });
      resetPending();
      withNext = false;
      lastFried = false;
      afterFood = true;
      i += m.len - 1;
      continue;
    }

    if (HALF_MORE.has(t)) {
      flushUnknown();
      if (pendingQty !== null || pendingUnit !== null) pendingQty = (pendingQty ?? 1) + 0.5;
      else if (drafts.length) {
        const d = drafts[drafts.length - 1];
        d.qty = (d.qty ?? (d.unit ? 1 : gramsFor(d.food, null, null).qty)) + 0.5;
      }
      continue;
    }

    const n = numberOf(t);
    if (n !== null) {
      flushUnknown();
      // A number before a food (or a unit and a food) belongs to that food; otherwise to the last one.
      const prev = drafts[drafts.length - 1];
      if (wasAfterFood && prev && prev.qty === null && closesPrevious(i + 1)) {
        prev.qty = n;
        const u = tokens[i + 1] ? unitOf(tokens[i + 1]) : null;
        if (u) {
          prev.unit = u;
          i++;
        }
        afterFood = true;
      } else if (foodAhead(i + 1) || !drafts.length) {
        pendingQty = pendingQty !== null && n === 0.5 ? pendingQty + 0.5 : n;
      } else {
        const d = drafts[drafts.length - 1];
        const u = tokens[i + 1] ? unitOf(tokens[i + 1]) : null;
        if (d.qty === null) {
          d.qty = n;
          if (u) {
            d.unit = u;
            i++;
          }
        }
      }
      continue;
    }

    const u = unitOf(t);
    if (u) {
      flushUnknown();
      const prev = drafts[drafts.length - 1];
      // "עגבנייה וכף טחינה": a unit with "ו" before a food starts the next food.
      const startsNext = t.startsWith("ו") && !(t in UNIT_WORDS) && foodAhead(i + 1);
      if (pendingQty === null && prev && prev.unit === null && ((wasAfterFood && !startsNext) || !foodAhead(i + 1))) {
        prev.unit = u;
        afterFood = true;
      } else pendingUnit = u;
      continue;
    }

    const s = sizeOf(t);
    if (s !== null) {
      flushUnknown();
      if (pendingQty !== null || pendingUnit !== null || !drafts.length) pendingSize = s;
      else drafts[drafts.length - 1].size = s;
      afterFood = wasAfterFood;
      continue;
    }

    if (FRIED.has(t) || stripped(t, (r) => FRIED.has(r))) {
      flushUnknown();
      if (drafts.length) drafts[drafts.length - 1].fried = true;
      lastFried = true;
      continue;
    }
    if (NEGATE.has(t)) {
      flushUnknown();
      negate = true;
      continue;
    }
    if (WITH.has(t)) {
      flushUnknown();
      withNext = true;
      continue;
    }
    if (FILLER.has(t) || stripped(t, (r) => FILLER.has(r)) || !/[א-תa-z]/.test(t) || t.length < 2) {
      flushUnknown();
      continue;
    }
    unknownRun.push(t);
  }
  flushUnknown();

  const items = drafts.map(toItem);
  return { items, unknown, kcal: items.reduce((a, x) => a + x.kcal, 0) };
}

function toItem(d: Draft): ParsedItem {
  let food = d.food;
  let label = d.label;
  let extraFat = 0;
  if (d.fried) {
    const alt = FRIED_OF[food.id] ? BY_ID.get(FRIED_OF[food.id]) : undefined;
    if (alt) {
      food = alt;
      label = alt.he[0];
    } else extraFat = 6;
  }
  let qty = d.qty;
  let unit = d.unit;
  // A splash of milk in coffee, a pour on cereal.
  if (qty === null && unit === null && d.addonOf && (food.id === "milk" || food.id === "milk_low" || food.id === "milk_soy" || food.id === "milk_almond")) {
    if (d.addonOf.x?.includes("hot")) [qty, unit] = [50, "ml"];
    else if (d.addonOf.x?.includes("cereal")) [qty, unit] = [150, "ml"];
  }
  const explicit = qty !== null || unit !== null;
  const a = gramsFor(food, unit, qty);
  const grams = Math.round(a.grams * d.size);
  const per = grams / 100;
  const kcal = Math.round(food.kcal * per + extraFat * 9 * per);
  const dish = food.x?.includes("dish");
  const confidence: FoodItem["confidence"] = explicit && !dish ? "high" : explicit || !dish ? "medium" : "low";
  const spread = confidence === "high" ? 0.1 : confidence === "medium" ? 0.2 : 0.3;
  const shownQty = Math.round(a.qty * 100) / 100;
  const unitName = unitLabel(a.unit, shownQty, food);
  const sizeWord = d.size > 1.01 ? " גדול" : d.size < 0.99 ? " קטן" : "";
  return {
    foodId: food.id,
    item_name: label + sizeWord,
    quantity: shownQty,
    unit: a.unit === "g" || a.unit === "ml" ? unitName : `${unitName} (${grams} ${food.x?.includes("drink") ? "מ״ל" : "ג׳"})`,
    preparation: d.fried && extraFat ? "מטוגן" : null,
    kcal_min: Math.round(kcal * (1 - spread)),
    kcal_max: Math.round(kcal * (1 + spread)),
    protein_g: Math.round(food.p * per * 10) / 10,
    carbs_g: Math.round(food.c * per * 10) / 10,
    fat_g: Math.round((food.f + extraFat) * per * 10) / 10,
    confidence,
    grams,
    kcal,
    explicit,
    unitKey: a.unit,
  };
}

/** "2 פרוסות (64 ג׳) לחם מלא" for lists. */
export function describeItem(i: Pick<FoodItem, "item_name" | "quantity" | "unit">): string {
  if (!i.quantity) return i.item_name;
  return `${fmtQty(i.quantity)} ${i.unit ? `${i.unit} ` : ""}${i.item_name}`;
}

/** Re-computes one parsed item for a new quantity (the +/− buttons). */
export function withQuantity(item: ParsedItem, qty: number): ParsedItem {
  const food = BY_ID.get(item.foodId);
  if (!food || qty <= 0 || !item.quantity) return item;
  const ratio = qty / item.quantity;
  const grams = Math.round(item.grams * ratio);
  const kcal = Math.round(item.kcal * ratio);
  const r = (v: number | null) => (v === null ? null : Math.round(v * ratio * 10) / 10);
  const unit = item.unit?.replace(/\(\d+ (ג׳|מ״ל)\)/, `(${grams} $1)`) ?? null;
  return {
    ...item,
    quantity: Math.round(qty * 100) / 100,
    unit: unit && qty > 1 !== item.quantity > 1 ? relabel(unit, qty) : unit,
    grams,
    kcal,
    kcal_min: Math.round((item.kcal_min ?? kcal) * ratio),
    kcal_max: Math.round((item.kcal_max ?? kcal) * ratio),
    protein_g: r(item.protein_g),
    carbs_g: r(item.carbs_g),
    fat_g: r(item.fat_g),
    explicit: true,
  };
}

/** The unit label for a new amount: "פרוסה" ↔ "פרוסות". */
export function relabel(unit: string, qty: number): string {
  for (const [one, many] of Object.values(UNIT_LABEL)) {
    if (qty > 1 && unit.startsWith(one + " ")) return many + unit.slice(one.length);
    if (qty <= 1 && unit.startsWith(many + " ")) return one + unit.slice(many.length);
  }
  if (qty > 1 && unit.startsWith("פחית ")) return "פחיות" + unit.slice(4);
  if (qty <= 1 && unit.startsWith("פחיות ")) return "פחית" + unit.slice(5);
  return unit;
}

const HALF_STEPS = new Set(["cup", "bowl", "plate", "serving", "row", "bag", "bar", "tray"]);

/** A step for the +/− buttons: whole eggs and slices (halves below one), half cups and bowls, 25 g / ml for weights. */
export function stepFor(item: ParsedItem): number {
  const q = item.quantity ?? 1;
  if (item.unitKey === "g" || item.unitKey === "ml") return q >= 200 ? 50 : 25;
  if (HALF_STEPS.has(item.unitKey) || q < 1 || q % 1 !== 0) return 0.5;
  return 1;
}

/** The stored shape of a parsed item (drops the parser's own fields). */
export function toFoodItem(p: ParsedItem): FoodItem {
  return {
    item_name: p.item_name,
    quantity: p.quantity,
    unit: p.unit,
    preparation: p.preparation,
    kcal_min: p.kcal_min,
    kcal_max: p.kcal_max,
    protein_g: p.protein_g,
    carbs_g: p.carbs_g,
    fat_g: p.fat_g,
    confidence: p.confidence,
  };
}
