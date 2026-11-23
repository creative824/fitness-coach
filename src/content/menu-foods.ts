/**
 * Foods the daily menu is built from, with calories and macros per unit.
 *
 * Values are typical Israeli supermarket products (per 100 g cooked, or per piece/spoon) from
 * the Israeli Ministry of Health food table and product labels, rounded. They are estimates,
 * shown as such in the app. `step` is the rounding unit of a portion and `min`/`max` keep a
 * scaled portion sensible (never 7 eggs, never 3 g of rice).
 */
export type FoodTag = "egg" | "milk" | "meat" | "fish" | "soy" | "sesame" | "tree_nut" | "peanut" | "gluten";

export type Unit =
  | { kind: "g" }
  | { kind: "ml" }
  /** Countable: one / many, e.g. ביצה / ביצים. */
  | { kind: "pc"; one: string; many: string };

export interface MenuFood {
  name: string;
  unit: Unit;
  /** kcal and macros per 1 unit: per gram / ml, or per piece. */
  kcal: number;
  p: number;
  c: number;
  f: number;
  step: number;
  min: number;
  max: number;
  tags: FoodTag[];
  /** A short household measure for gram amounts, e.g. "כחצי גביע". Shown next to the amount. */
  hint?: (qty: number) => string | null;
}

/** Per-100 g values, so the table below reads like a food label. */
const g100 = (kcal: number, p: number, c: number, f: number) => ({ kcal: kcal / 100, p: p / 100, c: c / 100, f: f / 100 });
const pc = (one: string, many: string): Unit => ({ kind: "pc", one, many });
const G: Unit = { kind: "g" };
const ML: Unit = { kind: "ml" };

const spoons = (gramsPerSpoon: number) => (q: number) => {
  const n = Math.round(q / gramsPerSpoon);
  return n <= 0 ? null : n === 1 ? "כף" : `כ-${n} כפות`;
};
const cups = (gramsPerCup: number) => (q: number) => {
  const r = q / gramsPerCup;
  if (r < 0.4) return null;
  if (r < 0.65) return "כחצי כוס";
  if (r < 0.9) return "כשלושה רבעים כוס";
  if (r < 1.2) return "ככוס";
  if (r < 1.65) return "ככוס וחצי";
  return `כ-${Math.round(r)} כוסות`;
};

export const FOODS = {
  egg: { name: "ביצה", unit: pc("ביצה", "ביצים"), kcal: 72, p: 6.3, c: 0.4, f: 4.8, step: 1, min: 1, max: 4, tags: ["egg"] },
  bread: { name: "לחם מלא", unit: pc("פרוסת לחם מלא", "פרוסות לחם מלא"), kcal: 75, p: 3.5, c: 13, f: 1, step: 1, min: 1, max: 4, tags: ["gluten"] },
  pita: { name: "פיתה מלאה", unit: pc("פיתה מלאה", "פיתות מלאות"), kcal: 170, p: 6, c: 33, f: 1.5, step: 0.5, min: 0.5, max: 2, tags: ["gluten"] },
  riceCake: { name: "פריכיות אורז", unit: pc("פריכיית אורז", "פריכיות אורז"), kcal: 30, p: 0.7, c: 6.5, f: 0.2, step: 1, min: 2, max: 6, tags: [] },
  oats: { name: "שיבולת שועל", unit: G, ...g100(375, 13, 63, 7), step: 10, min: 30, max: 90, tags: ["gluten"], hint: spoons(10) },
  cottage: { name: "קוטג׳ 5%", unit: G, ...g100(95, 11, 3.5, 5), step: 25, min: 100, max: 250, tags: ["milk"], hint: (q) => (q >= 225 ? "כגביע" : q >= 100 ? "כחצי גביע" : null) },
  whiteCheese: { name: "גבינה לבנה 5%", unit: G, ...g100(95, 9, 4, 5), step: 25, min: 50, max: 200, tags: ["milk"], hint: spoons(25) },
  yellowCheese: { name: "גבינה צהובה 9%", unit: pc("פרוסת גבינה צהובה 9%", "פרוסות גבינה צהובה 9%"), kcal: 50, p: 5.5, c: 0.3, f: 2.8, step: 1, min: 1, max: 4, tags: ["milk"] },
  yogurt: { name: "יוגורט חלבון", unit: G, ...g100(65, 10, 4.5, 0.5), step: 50, min: 150, max: 400, tags: ["milk"], hint: (q) => (q >= 180 && q <= 220 ? "גביע" : null) },
  milk: { name: "חלב 1%", unit: ML, ...g100(42, 3.3, 4.8, 1), step: 50, min: 100, max: 300, tags: ["milk"], hint: cups(240) },
  tuna: { name: "טונה במים", unit: G, ...g100(110, 25, 0, 1), step: 20, min: 60, max: 180, tags: ["fish"], hint: (q) => (q >= 100 && q <= 130 ? "כקופסה" : null) },
  chicken: { name: "חזה עוף צלוי", unit: G, ...g100(160, 31, 0, 3.5), step: 20, min: 80, max: 260, tags: ["meat"] },
  beef: { name: "בקר טחון רזה", unit: G, ...g100(200, 26, 0, 10), step: 20, min: 80, max: 200, tags: ["meat"] },
  turkey: { name: "פסטרמה הודו", unit: pc("פרוסת פסטרמה הודו", "פרוסות פסטרמה הודו"), kcal: 22, p: 4, c: 0.5, f: 0.4, step: 1, min: 2, max: 8, tags: ["meat"] },
  salmon: { name: "סלמון אפוי", unit: G, ...g100(205, 22, 0, 13), step: 20, min: 80, max: 200, tags: ["fish"] },
  whiteFish: { name: "פילה דג לבן אפוי", unit: G, ...g100(125, 24, 0, 3), step: 20, min: 100, max: 260, tags: ["fish"] },
  tofu: { name: "טופו", unit: G, ...g100(145, 15, 3, 8), step: 25, min: 75, max: 250, tags: ["soy"] },
  edamame: { name: "אדממה", unit: G, ...g100(120, 11, 9, 5), step: 25, min: 75, max: 200, tags: ["soy"], hint: cups(150) },
  lentils: { name: "עדשים מבושלות", unit: G, ...g100(115, 9, 20, 0.4), step: 25, min: 75, max: 300, tags: [], hint: cups(200) },
  chickpeas: { name: "גרגרי חומוס מבושלים", unit: G, ...g100(165, 9, 27, 2.6), step: 25, min: 75, max: 250, tags: [], hint: cups(160) },
  hummus: { name: "חומוס (ממרח)", unit: G, ...g100(250, 7, 14, 18), step: 10, min: 30, max: 120, tags: ["sesame"], hint: spoons(20) },
  tahini: { name: "טחינה גולמית", unit: pc("כף טחינה גולמית", "כפות טחינה גולמית"), kcal: 90, p: 2.6, c: 3, f: 8, step: 1, min: 1, max: 3, tags: ["sesame"] },
  oil: { name: "שמן זית", unit: pc("כפית שמן זית", "כפיות שמן זית"), kcal: 40, p: 0, c: 0, f: 4.5, step: 1, min: 1, max: 2, tags: [] },
  avocado: { name: "אבוקדו", unit: G, ...g100(160, 2, 9, 15), step: 10, min: 30, max: 100, tags: [], hint: (q) => (q <= 40 ? "כרבע אבוקדו" : q <= 70 ? "כשליש אבוקדו" : "כחצי אבוקדו") },
  almonds: { name: "שקדים", unit: G, ...g100(580, 21, 22, 50), step: 5, min: 10, max: 40, tags: ["tree_nut"], hint: (q) => `כ-${Math.round(q / 1.2)} שקדים` },
  walnuts: { name: "אגוזי מלך", unit: G, ...g100(650, 15, 14, 65), step: 5, min: 10, max: 30, tags: ["tree_nut"], hint: (q) => `כ-${Math.max(2, Math.round(q / 2.5))} חצאים` },
  peanutButter: { name: "חמאת בוטנים", unit: pc("כף חמאת בוטנים", "כפות חמאת בוטנים"), kcal: 95, p: 4, c: 3, f: 8, step: 1, min: 1, max: 2, tags: ["peanut"] },
  honey: { name: "דבש", unit: pc("כפית דבש", "כפיות דבש"), kcal: 21, p: 0, c: 5.7, f: 0, step: 1, min: 1, max: 2, tags: [] },
  rice: { name: "אורז מבושל", unit: G, ...g100(130, 2.7, 28, 0.3), step: 25, min: 75, max: 300, tags: [], hint: cups(160) },
  quinoa: { name: "קינואה מבושלת", unit: G, ...g100(120, 4.4, 21, 1.9), step: 25, min: 75, max: 300, tags: [], hint: cups(185) },
  bulgur: { name: "בורגול מבושל", unit: G, ...g100(85, 3, 19, 0.2), step: 25, min: 100, max: 300, tags: ["gluten"], hint: cups(180) },
  pasta: { name: "פסטה מלאה מבושלת", unit: G, ...g100(150, 6, 30, 1), step: 25, min: 100, max: 300, tags: ["gluten"], hint: cups(140) },
  sweetPotato: { name: "בטטה אפויה", unit: G, ...g100(90, 2, 21, 0.1), step: 25, min: 100, max: 350, tags: [] },
  potato: { name: "תפוח אדמה אפוי", unit: G, ...g100(93, 2.5, 21, 0.1), step: 25, min: 100, max: 350, tags: [] },
  salad: { name: "סלט ירקות", unit: pc("קערת סלט ירקות", "קערות סלט ירקות"), kcal: 50, p: 2, c: 9, f: 0.4, step: 1, min: 1, max: 1, tags: [] },
  vegSticks: { name: "מקלות ירקות", unit: pc("כוס מקלות ירקות", "כוסות מקלות ירקות"), kcal: 30, p: 1, c: 6, f: 0.2, step: 1, min: 1, max: 1, tags: [] },
  cookedVeg: { name: "ירקות מבושלים או אפויים", unit: G, ...g100(40, 1.5, 7, 0.5), step: 50, min: 150, max: 300, tags: [], hint: cups(150) },
  tomatoSauce: { name: "רוטב עגבניות", unit: G, ...g100(50, 1.5, 8, 1.5), step: 50, min: 100, max: 200, tags: [] },
  apple: { name: "תפוח", unit: pc("תפוח", "תפוחים"), kcal: 80, p: 0.4, c: 21, f: 0.2, step: 1, min: 1, max: 2, tags: [] },
  banana: { name: "בננה", unit: pc("בננה", "בננות"), kcal: 105, p: 1.3, c: 27, f: 0.4, step: 1, min: 1, max: 2, tags: [] },
  fruit: { name: "פרי עונתי", unit: pc("פרי עונתי בינוני", "פירות עונתיים בינוניים"), kcal: 70, p: 0.8, c: 17, f: 0.3, step: 1, min: 1, max: 3, tags: [] },
  berries: { name: "פירות יער", unit: G, ...g100(50, 0.8, 12, 0.3), step: 50, min: 50, max: 200, tags: [], hint: cups(140) },
  dates: { name: "תמר מג׳הול", unit: pc("תמר מג׳הול", "תמרי מג׳הול"), kcal: 66, p: 0.4, c: 18, f: 0, step: 1, min: 1, max: 4, tags: [] },
  tortilla: { name: "טורטייה מלאה", unit: pc("טורטייה מלאה", "טורטיות מלאות"), kcal: 140, p: 4, c: 23, f: 3.5, step: 1, min: 1, max: 2, tags: ["gluten"] },
  labaneh: { name: "לבנה 5%", unit: G, ...g100(90, 6, 4, 5), step: 10, min: 30, max: 120, tags: ["milk"], hint: spoons(20) },
  feta: { name: "גבינה בולגרית 5%", unit: G, ...g100(120, 16, 2, 5), step: 25, min: 25, max: 125, tags: ["milk"] },
  granola: { name: "גרנולה", unit: G, ...g100(450, 10, 64, 16), step: 10, min: 15, max: 60, tags: ["gluten"], hint: spoons(10) },
  proteinPudding: { name: "מעדן חלבון", unit: pc("מעדן חלבון", "מעדני חלבון"), kcal: 140, p: 20, c: 12, f: 1.5, step: 1, min: 1, max: 2, tags: ["milk"] },
  cornCob: { name: "קלח תירס", unit: pc("קלח תירס", "קלחי תירס"), kcal: 90, p: 3, c: 19, f: 1.4, step: 1, min: 1, max: 2, tags: [] },
  popcorn: { name: "פופקורן ביתי", unit: G, ...g100(390, 12, 78, 4.5), step: 5, min: 15, max: 45, tags: [], hint: (q) => `כ-${Math.max(2, Math.round(q / 8))} כוסות` },
  darkChocolate: { name: "שוקולד מריר 70%", unit: G, ...g100(560, 7, 45, 40), step: 5, min: 10, max: 25, tags: [], hint: (q) => `כ-${Math.max(1, Math.round(q / 5))} קוביות` },
  couscous: { name: "קוסקוס מלא מבושל", unit: G, ...g100(112, 3.8, 23, 0.2), step: 25, min: 100, max: 300, tags: ["gluten"], hint: cups(160) },
  buckwheat: { name: "כוסמת מבושלת", unit: G, ...g100(92, 3.4, 20, 0.6), step: 25, min: 100, max: 300, tags: [], hint: cups(170) },
  pargit: { name: "פרגית צלויה", unit: G, ...g100(180, 25, 0, 8.5), step: 20, min: 80, max: 220, tags: ["meat"] },
  whiteBeans: { name: "שעועית לבנה מבושלת", unit: G, ...g100(140, 9.7, 25, 0.4), step: 25, min: 75, max: 250, tags: [], hint: cups(180) },
  lentilSoup: { name: "מרק עדשים", unit: G, ...g100(60, 4, 9, 1), step: 50, min: 250, max: 500, tags: [], hint: (q) => (q >= 400 ? "קערה גדולה" : "קערה") },
  vegSoup: { name: "מרק ירקות", unit: G, ...g100(35, 1.2, 6, 0.8), step: 50, min: 300, max: 500, tags: [], hint: (q) => (q >= 400 ? "קערה גדולה" : "קערה") },
} satisfies Record<string, MenuFood>;

export type FoodKey = keyof typeof FOODS;
