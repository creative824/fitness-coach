/**
 * The food engine's arithmetic. The AI only understands the words (what the dish is, its
 * ingredients and amounts, how many units it made, how many were eaten); every number of
 * nutrition is worked out here, in code, from the best source available for each ingredient:
 *
 *   1. the package label the user typed in (per 100 g),
 *   2. a reliable product database (the slot is kept for when one is connected),
 *   3. the general food database (src/content/food-db.ts, USDA and Israeli labels),
 *   4. the AI's own per-100 g estimate, flagged as such.
 *
 * A recipe is counted whole, then per unit, then for the share eaten. Every amount that is not
 * known exactly is a range, and the result carries one of three accuracy levels. Pure.
 */
import { FOOD_DB, type DbFood } from "@/content/food-db";
import { normalize } from "./parse";

export interface Per100 {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export const UNITS = ["g", "kg", "ml", "l", "pc", "slice", "tbsp", "tsp", "cup", "bowl", "plate", "serving", "handful", "package"] as const;
export type Unit = (typeof UNITS)[number];

export interface UnderstoodIngredient {
  name: string;
  /** Amount in `unit`; null when not said. */
  qty: number | null;
  unit: Unit | null;
  /** "about a cup": the amount is a guess of the user's. */
  approx: boolean;
  /** The AI's estimate per 100 g, used only when no better source knows the food. */
  per100: Per100 | null;
}

export type DishKind = "single" | "recipe" | "pot_portion";

export interface Understanding {
  dish: string;
  kind: DishKind;
  ingredients: UnderstoodIngredient[];
  /** How many units the recipe made (40 truffles), or null. */
  yieldUnits: { min: number; max: number } | null;
  /** The unit's name ("כדורים", "פרוסות"). */
  unitName: string | null;
  /** How many units were eaten (6–7), or for a pot the share eaten (0.25). */
  eaten: { min: number; max: number } | null;
}

export interface Question {
  /** "g:<ingredient index>" for an ingredient's weight, "yield" or "eaten". */
  key: string;
  text: string;
  options: { label: string; value: number }[];
}

export type Source = "label" | "product" | "db" | "ai" | "none";
export type Accuracy = "high" | "medium" | "low";
export type Range = [number, number];

export interface Line {
  name: string;
  /** The database name it was matched to, if any. */
  matched: string | null;
  grams: Range;
  /** True when the weight came from the user (typed, or a question answered). */
  gramsKnown: boolean;
  source: Source;
  per100: Per100 | null;
  kcal: Range;
  protein: Range;
  carbs: Range;
  fat: Range;
}

export interface Nutrition {
  kcal: Range;
  protein: Range;
  carbs: Range;
  fat: Range;
}

export interface MealResult {
  dish: string;
  kind: DishKind;
  lines: Line[];
  total: Nutrition;
  /** Per unit, when the recipe's yield is known. */
  perUnit: Nutrition | null;
  yieldUnits: Range | null;
  unitName: string | null;
  /** Units eaten (or, for a pot, the share). */
  eaten: Range | null;
  /** The share of the whole recipe eaten (0–1). */
  share: Range;
  /** What was eaten: the share of the total. */
  meal: Nutrition;
  accuracy: Accuracy;
  /** Questions whose answers would narrow the ranges, the most useful first. */
  questions: Question[];
}

export interface Inputs {
  /** Answers to questions, by key (grams for "g:i", units for "yield" and "eaten"). */
  answers?: Record<string, number>;
  /** Package labels typed by the user, by ingredient index. */
  labels?: Record<number, Per100>;
  /** A product database lookup (none yet); returns per 100 g for a name. */
  product?: (name: string) => Per100 | null;
}

export const ACCURACY_LABEL: Record<Accuracy, string> = { high: "דיוק גבוה", medium: "דיוק בינוני", low: "הערכה גסה" };

// ───────────────────────── matching ─────────────────────────

const NAMES: { name: string; food: DbFood }[] = FOOD_DB.flatMap((food) => food.he.map((n) => ({ name: normalize(n), food }))).sort((a, b) => b.name.length - a.name.length);

/**
 * The database food a written name refers to: the longest database name the name starts with,
 * as whole words. Hebrew puts the head noun first, so "חמאת בוטנים טבעית" is peanut butter but
 * "עוגת תמרים" is not dates.
 */
export function findFood(name: string): DbFood | null {
  const n = `${normalize(name).replace(/ , /g, " ").trim()} `;
  for (const e of NAMES) {
    if (n.startsWith(`${e.name} `)) return e.food;
    // A one-letter prefix: "השוקולד", "וחמאת בוטנים".
    if (/^[והבלמש]/.test(n) && n.slice(1).startsWith(`${e.name} `)) return e.food;
  }
  return null;
}

/** Common package sizes in Israel, in grams, by database food. The first is the usual one. */
const PACKAGES: Record<string, { label: string; value: number }[]> = {
  dark_chocolate: [{ label: "חפיסה רגילה (100 גרם)", value: 100 }, { label: "חפיסה קטנה (80 גרם)", value: 80 }, { label: "חפיסה גדולה (200 גרם)", value: 200 }],
  chocolate: [{ label: "חפיסה רגילה (100 גרם)", value: 100 }, { label: "חפיסה קטנה (80 גרם)", value: 80 }, { label: "חפיסה גדולה (200 גרם)", value: 200 }],
  peanut_butter: [{ label: "צנצנת 340 גרם", value: 340 }, { label: "צנצנת 500 גרם", value: 500 }, { label: "צנצנת 1 ק״ג", value: 1000 }],
  choc_spread: [{ label: "צנצנת 350 גרם", value: 350 }, { label: "צנצנת 750 גרם", value: 750 }],
  cornflakes: [{ label: "קופסה 500 גרם", value: 500 }, { label: "קופסה 750 גרם", value: 750 }],
  oats: [{ label: "שקית 500 גרם", value: 500 }, { label: "שקית 1 ק״ג", value: 1000 }],
  granola: [{ label: "שקית 500 גרם", value: 500 }, { label: "שקית 350 גרם", value: 350 }],
  pasta: [{ label: "חבילה 500 גרם (יבשה)", value: 500 }],
};
const GENERIC_PACKAGE = [{ label: "100 גרם", value: 100 }, { label: "250 גרם", value: 250 }, { label: "500 גרם", value: 500 }];

/** Grams of one household unit when the food has none of its own. */
const GENERIC_UNIT: Partial<Record<Unit, number>> = { tbsp: 15, tsp: 5, cup: 240, bowl: 300, plate: 350, handful: 30, serving: 150, pc: 50, slice: 30 };
const UNIT_HE: Partial<Record<Unit, string>> = { cup: "כוס", tbsp: "כף", tsp: "כפית", bowl: "קערה", plate: "צלחת", handful: "חופן", serving: "מנה", pc: "יחידה", slice: "פרוסה" };

// ───────────────────────── arithmetic ─────────────────────────

const r = (v: number, step = 1) => Math.round(v / step) * step;
const mul = (a: Range, k: Range): Range => [a[0] * k[0], a[1] * k[1]];
const add = (a: Range, b: Range): Range => [a[0] + b[0], a[1] + b[1]];
const ZERO: Range = [0, 0];
const mid = (x: Range) => (x[0] + x[1]) / 2;

function nutritionOf(lines: Line[]): Nutrition {
  return lines.reduce((t, l) => ({ kcal: add(t.kcal, l.kcal), protein: add(t.protein, l.protein), carbs: add(t.carbs, l.carbs), fat: add(t.fat, l.fat) }), { kcal: ZERO, protein: ZERO, carbs: ZERO, fat: ZERO });
}
function scale(n: Nutrition, k: Range): Nutrition {
  return { kcal: mul(n.kcal, k), protein: mul(n.protein, k), carbs: mul(n.carbs, k), fat: mul(n.fat, k) };
}
/** Rounded for display: calories to 5, grams to 1. */
export function rounded(n: Nutrition): Nutrition {
  const rr = (x: Range, s: number): Range => [r(x[0], s), r(x[1], s)];
  return { kcal: rr(n.kcal, 5), protein: rr(n.protein, 1), carbs: rr(n.carbs, 1), fat: rr(n.fat, 1) };
}

/** An ingredient's weight as a range, and the question that would pin it down. */
function gramsOf(i: UnderstoodIngredient, food: DbFood | null, k: number, answers: Record<string, number>): { grams: Range; known: boolean; question: Question | null } {
  const key = `g:${k}`;
  if (answers[key] > 0) return { grams: [answers[key], answers[key]], known: true, question: null };
  const spread = (g: number, f: number): Range => (i.approx ? [g * (1 - f), g * (1 + f)] : [g, g]);
  if (i.unit === "g" || i.unit === "ml") return { grams: spread(i.qty ?? 100, 0.15), known: !i.approx && i.qty !== null, question: null };
  if (i.unit === "kg" || i.unit === "l") return { grams: spread((i.qty ?? 1) * 1000, 0.15), known: !i.approx && i.qty !== null, question: null };
  if (i.unit === "package") {
    const options = (food && PACKAGES[food.id]) ?? GENERIC_PACKAGE;
    const values = options.map((o) => o.value);
    const n = i.qty ?? 1;
    const lo = food && PACKAGES[food.id] ? Math.min(...values.slice(0, 2)) : Math.min(...values);
    const hi = food && PACKAGES[food.id] ? Math.max(...values.slice(0, 2)) : Math.max(...values);
    return {
      grams: [lo * n, hi * n],
      known: false,
      question: { key, text: `כמה שקלה האריזה של ${i.name}?`, options: [...options.map((o) => ({ label: o.label, value: o.value * n }))] },
    };
  }
  const unit = i.unit ?? (food ? null : "serving");
  const per = unit ? ((food?.u[unit] as number | undefined) ?? GENERIC_UNIT[unit] ?? 100) : food ? (food.u[food.d[0]] ?? 100) * food.d[1] : 100;
  const qty = i.qty ?? 1;
  const g = per * qty;
  if (i.qty === null && i.unit === null) {
    // No amount at all: the usual portion, give or take a third, and a question.
    const label = unit ? UNIT_HE[unit] : null;
    return {
      grams: [g * 0.7, g * 1.3],
      known: false,
      question: { key, text: `כמה ${i.name} היה בערך?`, options: [0.5, 1, 1.5].map((m) => ({ label: `${r(g * m, 5)} גרם${label ? "" : ""}`, value: r(g * m, 5) })) },
    };
  }
  const fuzzy = i.approx || unit === "cup" || unit === "bowl" || unit === "plate" || unit === "handful" || unit === "serving";
  return { grams: fuzzy ? [g * 0.8, g * 1.2] : [g, g], known: !fuzzy, question: null };
}

/**
 * Works out a meal from what the AI understood. Deterministic: the same words, answers and
 * labels always give the same numbers.
 */
export function computeMeal(u: Understanding, inputs: Inputs = {}): MealResult {
  const answers = inputs.answers ?? {};
  const questions: Question[] = [];
  const lines: Line[] = u.ingredients.map((ing, k) => {
    const food = findFood(ing.name);
    const label = inputs.labels?.[k] ?? null;
    const product = label ? null : (inputs.product?.(ing.name) ?? null);
    const per100: Per100 | null = label ?? product ?? (food ? { kcal: food.kcal, p: food.p, c: food.c, f: food.f } : null) ?? ing.per100;
    const source: Source = label ? "label" : product ? "product" : food ? "db" : ing.per100 ? "ai" : "none";
    const g = gramsOf(ing, food, k, answers);
    if (g.question) questions.push(g.question);
    const per = (v: number): Range => [(g.grams[0] * v) / 100, (g.grams[1] * v) / 100];
    return {
      name: ing.name,
      matched: food?.he[0] ?? null,
      grams: g.grams,
      gramsKnown: g.known,
      source,
      per100,
      kcal: per100 ? per(per100.kcal) : ZERO,
      protein: per100 ? per(per100.p) : ZERO,
      carbs: per100 ? per(per100.c) : ZERO,
      fat: per100 ? per(per100.f) : ZERO,
    };
  });
  const total = nutritionOf(lines);

  // How much of the whole was eaten.
  let yieldUnits: Range | null = null;
  let eaten: Range | null = null;
  let share: Range = [1, 1];
  let perUnit: Nutrition | null = null;
  if (u.kind === "recipe") {
    const y = answers.yield > 0 ? ([answers.yield, answers.yield] as Range) : u.yieldUnits ? ([u.yieldUnits.min, u.yieldUnits.max] as Range) : null;
    const e = answers.eaten > 0 ? ([answers.eaten, answers.eaten] as Range) : u.eaten ? ([u.eaten.min, u.eaten.max] as Range) : null;
    yieldUnits = y;
    eaten = e;
    if (!y) questions.push({ key: "yield", text: `לכמה ${u.unitName ?? "יחידות"} יצא המתכון?`, options: [10, 20, 30, 40].map((v) => ({ label: String(v), value: v })) });
    if (!e) questions.push({ key: "eaten", text: `כמה ${u.unitName ?? "יחידות"} אכלת?`, options: [1, 2, 3, 4].map((v) => ({ label: String(v), value: v })) });
    if (y) {
      // Per unit: the low total over the most units, the high total over the fewest.
      perUnit = { kcal: [total.kcal[0] / y[1], total.kcal[1] / y[0]], protein: [total.protein[0] / y[1], total.protein[1] / y[0]], carbs: [total.carbs[0] / y[1], total.carbs[1] / y[0]], fat: [total.fat[0] / y[1], total.fat[1] / y[0]] };
      if (e) share = [Math.min(1, e[0] / y[1]), Math.min(1, e[1] / y[0])];
    }
  } else if (u.kind === "pot_portion") {
    const e = answers.eaten > 0 ? ([answers.eaten, answers.eaten] as Range) : u.eaten ? ([u.eaten.min, u.eaten.max] as Range) : null;
    eaten = e;
    if (e) share = [Math.min(1, e[0]), Math.min(1, e[1])];
    else questions.push({ key: "eaten", text: "איזה חלק מהסיר אכלת?", options: [{ label: "רבע", value: 0.25 }, { label: "שליש", value: 0.33 }, { label: "חצי", value: 0.5 }] });
  }
  const meal = perUnit && eaten ? scale(perUnit, eaten) : scale(total, share);

  // Accuracy: high when every weight and value is solid, low when the AI had to guess values
  // or the share is unknown, medium in between.
  const unknownShare = (u.kind === "recipe" && (!yieldUnits || !eaten)) || (u.kind === "pot_portion" && !eaten);
  const guessed = lines.some((l) => l.source === "ai" || l.source === "none");
  const ranged = lines.some((l) => !l.gramsKnown) || (yieldUnits && yieldUnits[0] !== yieldUnits[1]) || (eaten && eaten[0] !== eaten[1]);
  const accuracy: Accuracy = guessed || unknownShare ? "low" : ranged ? "medium" : "high";

  // The questions that move the result most come first.
  const weight = (q: Question) => {
    if (q.key === "yield" || q.key === "eaten") return Infinity;
    const l = lines[Number(q.key.slice(2))];
    return l ? l.kcal[1] - l.kcal[0] : 0;
  };
  questions.sort((a, b) => weight(b) - weight(a));

  return { dish: u.dish, kind: u.kind, lines, total, perUnit, yieldUnits, unitName: u.unitName, eaten, share, meal, accuracy, questions };
}

/** The default point in a range (6–7 pieces → 6.5), for one number where one is needed. */
export const pointOf = mid;

// ───────────────────────── the AI's answer ─────────────────────────

/** What the AI is asked to return: words understood, no nutrition totals. */
export const UNDERSTAND_SCHEMA = {
  type: "OBJECT",
  properties: {
    not_food: { type: "BOOLEAN" },
    dish: { type: "STRING" },
    kind: { type: "STRING", enum: ["single", "recipe", "pot_portion"] },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          qty: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", enum: [...UNITS], nullable: true },
          approx: { type: "BOOLEAN" },
          kcal_100: { type: "NUMBER" },
          protein_100: { type: "NUMBER" },
          carbs_100: { type: "NUMBER" },
          fat_100: { type: "NUMBER" },
        },
        required: ["name", "approx", "kcal_100", "protein_100", "carbs_100", "fat_100"],
      },
    },
    yield_min: { type: "NUMBER", nullable: true },
    yield_max: { type: "NUMBER", nullable: true },
    unit_name: { type: "STRING", nullable: true },
    eaten_min: { type: "NUMBER", nullable: true },
    eaten_max: { type: "NUMBER", nullable: true },
  },
  required: ["not_food", "dish", "kind", "ingredients"],
};

const n = (v: unknown, max: number): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : null);
const rangeOf = (lo: unknown, hi: unknown, max: number) => {
  const a = n(lo, max) ?? n(hi, max);
  const b = n(hi, max) ?? a;
  return a !== null && b !== null ? { min: Math.min(a, b), max: Math.max(a, b) } : null;
};

export type UnderstandResult = { ok: true; understanding: Understanding } | { ok: false; reason: "not_food" | "failed" };

/** Reads the AI's JSON into an Understanding; anything malformed is dropped, never guessed. */
export function parseUnderstanding(raw: string): UnderstandResult {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (!j || typeof j !== "object") return { ok: false, reason: "failed" };
  if (j.not_food === true) return { ok: false, reason: "not_food" };
  const kind: DishKind = j.kind === "recipe" || j.kind === "pot_portion" ? j.kind : "single";
  const ingredients: UnderstoodIngredient[] = (Array.isArray(j.ingredients) ? j.ingredients : []).slice(0, 25).flatMap((x: Record<string, unknown>) => {
    const name = typeof x?.name === "string" ? x.name.trim().slice(0, 80) : "";
    if (!name) return [];
    const unit = (UNITS as readonly string[]).includes(x.unit as string) ? (x.unit as Unit) : null;
    const kcal = typeof x.kcal_100 === "number" && x.kcal_100 >= 0 && x.kcal_100 <= 900 ? x.kcal_100 : null;
    const g = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 100 ? v : 0);
    return [{ name, qty: n(x.qty, 100000), unit, approx: x.approx === true, per100: kcal !== null ? { kcal, p: g(x.protein_100), c: g(x.carbs_100), f: g(x.fat_100) } : null }];
  });
  if (!ingredients.length) return { ok: false, reason: "failed" };
  const dish = typeof j.dish === "string" && j.dish.trim() ? j.dish.trim().slice(0, 80) : ingredients.map((i) => i.name).join(", ").slice(0, 80);
  return {
    ok: true,
    understanding: {
      dish,
      kind,
      ingredients,
      yieldUnits: kind === "recipe" ? rangeOf(j.yield_min, j.yield_max, 1000) : null,
      unitName: typeof j.unit_name === "string" && j.unit_name.trim() ? j.unit_name.trim().slice(0, 30) : null,
      eaten: kind === "single" ? null : rangeOf(j.eaten_min, j.eaten_max, kind === "pot_portion" ? 1 : 1000),
    },
  };
}

const CONF: Record<Accuracy, "high" | "medium" | "low"> = { high: "high", medium: "medium", low: "low" };
const fmt = (x: Range) => (Math.round(x[0] * 10) === Math.round(x[1] * 10) ? String(Math.round(x[0] * 10) / 10) : `${Math.round(x[0] * 10) / 10}–${Math.round(x[1] * 10) / 10}`);

/** Log items for a worked-out meal: one per food for a plain meal, one for a recipe's share. */
export function itemsOf(m: MealResult) {
  const item = (name: string, nut: Nutrition, qty: number | null, unit: string | null) => {
    const k = rounded(nut);
    return {
      item_name: name.slice(0, 120),
      quantity: qty,
      unit,
      preparation: null,
      kcal_min: Math.max(0, k.kcal[0]),
      kcal_max: Math.max(0, k.kcal[1]),
      protein_g: Math.round(pointOf(nut.protein) * 10) / 10,
      carbs_g: Math.round(pointOf(nut.carbs) * 10) / 10,
      fat_g: Math.round(pointOf(nut.fat) * 10) / 10,
      confidence: CONF[m.accuracy],
    };
  };
  if (m.kind === "single") {
    return m.lines.map((l) => item(l.name, { kcal: l.kcal, protein: l.protein, carbs: l.carbs, fat: l.fat }, Math.round(pointOf(l.grams)), "גרם"));
  }
  const what = m.kind === "recipe" && m.eaten ? `${m.dish} (${fmt(m.eaten)} ${m.unitName ?? "יחידות"})` : m.dish;
  return [item(what, m.meal, m.eaten ? pointOf(m.eaten) : null, m.kind === "recipe" ? (m.unitName ?? "יחידות") : null)];
}
