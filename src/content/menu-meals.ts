/**
 * Meals of the daily menu. Each meal is a list of foods with a base portion; the menu engine
 * (src/lib/menu/engine.ts) scales the portions to the calories of the slot and works out the
 * allergens and diet from the foods, so nothing here is tagged by hand.
 *
 * `fixed` parts (a salad, a cup of vegetable sticks) stay as they are when a meal is scaled.
 */
import type { FoodKey } from "./menu-foods";

export type SlotType = "breakfast" | "snack" | "lunch" | "dinner";

export interface MenuMeal {
  slug: string;
  title: string;
  slots: SlotType[];
  parts: { food: FoodKey; qty: number; fixed?: boolean }[];
  /** One short line on how to put it together. */
  tip?: string;
  /** A light meal (about 200–300 kcal as written), shown with a "קליל" mark. */
  light?: boolean;
}

const salad = { food: "salad" as const, qty: 1, fixed: true };
const sticks = { food: "vegSticks" as const, qty: 1, fixed: true };

export const MENU_MEALS: MenuMeal[] = [
  // ── Breakfast ──────────────────────────────────────────────
  { slug: "omelette-bread", title: "חביתה, לחם מלא וסלט", slots: ["breakfast", "dinner"],
    parts: [{ food: "egg", qty: 2 }, { food: "bread", qty: 2 }, salad, { food: "oil", qty: 1 }], tip: "החביתה במחבת עם כפית השמן, הסלט בלי רוטב או עם לימון." },
  { slug: "yogurt-oats-berries", title: "יוגורט חלבון עם שיבולת שועל ופירות יער", slots: ["breakfast"],
    parts: [{ food: "yogurt", qty: 200 }, { food: "oats", qty: 40 }, { food: "berries", qty: 100 }, { food: "honey", qty: 1 }] },
  { slug: "toast-cheese", title: "טוסט גבינה צהובה עם ירקות", slots: ["breakfast", "dinner"],
    parts: [{ food: "bread", qty: 2 }, { food: "yellowCheese", qty: 2 }, salad] },
  { slug: "white-cheese-bread", title: "לחם מלא עם גבינה לבנה וירקות", slots: ["breakfast", "dinner"],
    parts: [{ food: "bread", qty: 2 }, { food: "whiteCheese", qty: 75 }, salad, { food: "oil", qty: 1 }] },
  { slug: "oatmeal-banana", title: "דייסת שיבולת שועל בחלב עם בננה", slots: ["breakfast"],
    parts: [{ food: "oats", qty: 50 }, { food: "milk", qty: 200 }, { food: "banana", qty: 1 }], tip: "מבשלים 3–4 דקות על אש קטנה ומוסיפים בננה פרוסה." },
  { slug: "oatmeal-dates-walnuts", title: "דייסת שיבולת שועל עם תמרים ואגוזים", slots: ["breakfast"],
    parts: [{ food: "oats", qty: 50 }, { food: "dates", qty: 2 }, { food: "walnuts", qty: 10 }], tip: "מבשלים במים ומפזרים מעל תמרים קצוצים ואגוזים." },
  { slug: "shakshuka-bread", title: "שקשוקה עם לחם מלא", slots: ["breakfast", "dinner"],
    parts: [{ food: "egg", qty: 2 }, { food: "tomatoSauce", qty: 150 }, { food: "bread", qty: 1 }, { food: "oil", qty: 1 }] },
  { slug: "avocado-egg-toast", title: "טוסט אבוקדו וביצה", slots: ["breakfast"],
    parts: [{ food: "bread", qty: 2 }, { food: "avocado", qty: 50 }, { food: "egg", qty: 1 }] },
  { slug: "tahini-bread", title: "לחם מלא עם טחינה וירקות", slots: ["breakfast"],
    parts: [{ food: "bread", qty: 2 }, { food: "tahini", qty: 1 }, salad] },
  { slug: "cottage-ricecakes", title: "קוטג׳ עם פריכיות וירקות", slots: ["breakfast", "dinner"],
    parts: [{ food: "cottage", qty: 175 }, { food: "riceCake", qty: 3 }, salad] },
  { slug: "tofu-scramble", title: "טופו מקושקש עם לחם מלא", slots: ["breakfast", "dinner"],
    parts: [{ food: "tofu", qty: 150 }, { food: "bread", qty: 1 }, salad, { food: "oil", qty: 1 }], tip: "מפוררים את הטופו למחבת עם כורכום ובצל." },
  { slug: "turkey-sandwich", title: "כריך פסטרמה הודו עם אבוקדו", slots: ["breakfast", "lunch"],
    parts: [{ food: "bread", qty: 2 }, { food: "turkey", qty: 4 }, { food: "avocado", qty: 30 }, salad] },

  // Lighter mornings: ideas from Israeli and international lists of breakfasts under 300 kcal.
  { slug: "yogurt-fruit", title: "יוגורט חלבון עם פרי", slots: ["breakfast"], light: true,
    parts: [{ food: "yogurt", qty: 200 }, { food: "fruit", qty: 1 }], tip: "אפשר לפזר קינמון מעל." },
  { slug: "cottage-slice-veg", title: "קוטג׳ עם פרוסת לחם וירקות", slots: ["breakfast"], light: true,
    parts: [{ food: "cottage", qty: 125 }, { food: "bread", qty: 1 }, sticks] },
  { slug: "boiled-eggs-slice", title: "ביצים קשות, פרוסת לחם וירקות", slots: ["breakfast"], light: true,
    parts: [{ food: "egg", qty: 2 }, { food: "bread", qty: 1 }, sticks], tip: "אפשר להכין כמה ביצים מראש לכל השבוע." },
  { slug: "berry-smoothie", title: "שייק בננה, פירות יער וחלב", slots: ["breakfast"],
    parts: [{ food: "milk", qty: 250 }, { food: "banana", qty: 1 }, { food: "berries", qty: 100 }, { food: "oats", qty: 30 }], tip: "הכול לבלנדר עם כמה קוביות קרח." },
  { slug: "oat-pancakes", title: "פנקייק שיבולת שועל ובננה", slots: ["breakfast"],
    parts: [{ food: "oats", qty: 40 }, { food: "egg", qty: 2 }, { food: "banana", qty: 1 }, { food: "honey", qty: 1 }], tip: "טוחנים שיבולת שועל, בננה וביצים לבלילה ומטגנים במחבת נגד הדבקה." },
  { slug: "labaneh-toast", title: "טוסט לבנה, זעתר וירקות", slots: ["breakfast", "dinner"], light: true,
    parts: [{ food: "bread", qty: 2 }, { food: "labaneh", qty: 50 }, salad] },
  { slug: "feta-tomato-slice", title: "גבינה בולגרית, עגבנייה ופרוסת לחם", slots: ["breakfast"], light: true,
    parts: [{ food: "feta", qty: 50 }, { food: "bread", qty: 1 }, salad] },
  { slug: "yogurt-granola", title: "יוגורט עם גרנולה ופרי", slots: ["breakfast"],
    parts: [{ food: "yogurt", qty: 150 }, { food: "granola", qty: 30 }, { food: "fruit", qty: 1 }] },
  { slug: "ricecake-avocado-egg", title: "פריכיות עם אבוקדו וביצה", slots: ["breakfast"], light: true,
    parts: [{ food: "riceCake", qty: 2 }, { food: "avocado", qty: 40 }, { food: "egg", qty: 1 }] },
  { slug: "pudding-fruit", title: "מעדן חלבון ופרי", slots: ["breakfast"], light: true,
    parts: [{ food: "proteinPudding", qty: 1 }, { food: "fruit", qty: 1 }], tip: "הכי מהיר: מתאים כשאין זמן בבוקר." },
  { slug: "tuna-ricecakes", title: "פריכיות עם סלט טונה", slots: ["breakfast", "dinner"], light: true,
    parts: [{ food: "riceCake", qty: 3 }, { food: "tuna", qty: 80 }, sticks] },
  { slug: "pb-banana-toast", title: "טוסט חמאת בוטנים ובננה", slots: ["breakfast"],
    parts: [{ food: "bread", qty: 2 }, { food: "peanutButter", qty: 1 }, { food: "banana", qty: 1 }] },

  // ── Snacks ─────────────────────────────────────────────────
  { slug: "apple-pb", title: "תפוח עם חמאת בוטנים", slots: ["snack"], parts: [{ food: "apple", qty: 1 }, { food: "peanutButter", qty: 1 }] },
  { slug: "yogurt-berries", title: "יוגורט חלבון עם פירות יער", slots: ["snack"], parts: [{ food: "yogurt", qty: 150 }, { food: "berries", qty: 100 }] },
  { slug: "almonds", title: "חופן שקדים", slots: ["snack"], parts: [{ food: "almonds", qty: 25 }] },
  { slug: "fruit", title: "פרי עונתי", slots: ["snack"], parts: [{ food: "fruit", qty: 2 }] },
  { slug: "veg-hummus", title: "מקלות ירקות עם חומוס", slots: ["snack"], parts: [{ food: "vegSticks", qty: 1, fixed: true }, { food: "hummus", qty: 40 }] },
  { slug: "egg-veg", title: "ביצה קשה ומקלות ירקות", slots: ["snack"], parts: [{ food: "egg", qty: 2 }, { food: "vegSticks", qty: 1, fixed: true }] },
  { slug: "ricecake-cheese", title: "פריכיות עם גבינה לבנה", slots: ["snack"], parts: [{ food: "riceCake", qty: 2 }, { food: "whiteCheese", qty: 50 }] },
  { slug: "banana-almonds", title: "בננה וכמה שקדים", slots: ["snack"], parts: [{ food: "banana", qty: 1 }, { food: "almonds", qty: 10 }] },
  { slug: "dates-walnuts", title: "תמרים ואגוזי מלך", slots: ["snack"], parts: [{ food: "dates", qty: 2 }, { food: "walnuts", qty: 10 }] },
  { slug: "cottage-veg", title: "קוטג׳ עם מקלות ירקות", slots: ["snack"], parts: [{ food: "cottage", qty: 125 }, { food: "vegSticks", qty: 1, fixed: true }] },
  { slug: "edamame", title: "אדממה מאודה", slots: ["snack"], parts: [{ food: "edamame", qty: 125 }] },
  { slug: "milk-fruit", title: "כוס חלב ופרי", slots: ["snack"], parts: [{ food: "milk", qty: 200 }, { food: "fruit", qty: 1 }] },
  { slug: "corn", title: "קלח תירס", slots: ["snack"], parts: [{ food: "cornCob", qty: 1 }] },
  { slug: "popcorn", title: "פופקורן ביתי", slots: ["snack"], parts: [{ food: "popcorn", qty: 25 }], tip: "בסיר עם מכסה, בלי חמאה." },
  { slug: "chocolate-almonds", title: "שוקולד מריר ושקדים", slots: ["snack"], parts: [{ food: "darkChocolate", qty: 10 }, { food: "almonds", qty: 10 }] },
  { slug: "pudding", title: "מעדן חלבון", slots: ["snack"], parts: [{ food: "proteinPudding", qty: 1 }] },
  { slug: "feta-sticks", title: "גבינה בולגרית עם מקלות ירקות", slots: ["snack"], parts: [{ food: "feta", qty: 50 }, sticks] },
  { slug: "labaneh-ricecakes", title: "פריכיות עם לבנה", slots: ["snack"], parts: [{ food: "riceCake", qty: 2 }, { food: "labaneh", qty: 40 }] },
  { slug: "yogurt-granola-small", title: "יוגורט עם כף גרנולה", slots: ["snack"], parts: [{ food: "yogurt", qty: 150 }, { food: "granola", qty: 20 }] },
  { slug: "turkey-rolls", title: "רולדות פסטרמה הודו ומלפפון", slots: ["snack"], parts: [{ food: "turkey", qty: 4 }, sticks] },
  { slug: "fruit-cheese", title: "פרי ופרוסת גבינה צהובה", slots: ["snack"], parts: [{ food: "fruit", qty: 1 }, { food: "yellowCheese", qty: 1 }] },
  { slug: "berry-milk-shake", title: "שייק פירות יער וחלב", slots: ["snack"], parts: [{ food: "milk", qty: 200 }, { food: "berries", qty: 100 }] },
  { slug: "roasted-chickpeas", title: "גרגרי חומוס קלויים", slots: ["snack"], parts: [{ food: "chickpeas", qty: 75 }], tip: "בתנור 25 דקות עם פפריקה וכמון." },

  // ── Lunch ──────────────────────────────────────────────────
  { slug: "chicken-rice", title: "חזה עוף, אורז וסלט", slots: ["lunch", "dinner"],
    parts: [{ food: "chicken", qty: 150 }, { food: "rice", qty: 150 }, salad, { food: "oil", qty: 1 }] },
  { slug: "salmon-sweet-potato", title: "סלמון, בטטה וירקות אפויים", slots: ["lunch", "dinner"],
    parts: [{ food: "salmon", qty: 140 }, { food: "sweetPotato", qty: 150 }, { food: "cookedVeg", qty: 200, fixed: true }] },
  { slug: "quinoa-tofu", title: "קערת קינואה, טופו וירקות", slots: ["lunch"],
    parts: [{ food: "quinoa", qty: 150 }, { food: "tofu", qty: 125 }, { food: "cookedVeg", qty: 150, fixed: true }, { food: "tahini", qty: 1 }] },
  { slug: "fish-rice", title: "דג לבן אפוי, אורז וסלט", slots: ["lunch", "dinner"],
    parts: [{ food: "whiteFish", qty: 180 }, { food: "rice", qty: 150 }, salad, { food: "oil", qty: 1 }] },
  { slug: "pasta-tuna", title: "פסטה מלאה עם טונה ורוטב עגבניות", slots: ["lunch"],
    parts: [{ food: "pasta", qty: 175 }, { food: "tuna", qty: 100 }, { food: "tomatoSauce", qty: 100 }, salad] },
  { slug: "beef-bulgur", title: "בקר רזה, בורגול וסלט", slots: ["lunch"],
    parts: [{ food: "beef", qty: 120 }, { food: "bulgur", qty: 150 }, salad, { food: "oil", qty: 1 }] },
  { slug: "pita-hummus-egg", title: "פיתה מלאה עם חומוס, ביצה וסלט", slots: ["lunch"],
    parts: [{ food: "pita", qty: 1 }, { food: "hummus", qty: 60 }, { food: "egg", qty: 1 }, salad] },
  { slug: "mujadara", title: "מג׳דרה (אורז ועדשים) עם סלט", slots: ["lunch", "dinner"],
    parts: [{ food: "lentils", qty: 150 }, { food: "rice", qty: 125 }, salad, { food: "oil", qty: 1 }] },
  { slug: "chicken-pita", title: "פיתה מלאה עם חזה עוף, סלט וטחינה", slots: ["lunch"],
    parts: [{ food: "pita", qty: 1 }, { food: "chicken", qty: 120 }, salad, { food: "tahini", qty: 1 }] },
  { slug: "masabacha", title: "מסבחה (גרגרי חומוס וטחינה) עם חצי פיתה", slots: ["lunch"],
    parts: [{ food: "chickpeas", qty: 150 }, { food: "tahini", qty: 1 }, { food: "pita", qty: 0.5 }, salad] },
  { slug: "chicken-potato", title: "עוף צלוי, תפוח אדמה וירקות", slots: ["lunch", "dinner"],
    parts: [{ food: "chicken", qty: 150 }, { food: "potato", qty: 200 }, { food: "cookedVeg", qty: 150, fixed: true }, { food: "oil", qty: 1 }] },

  { slug: "chicken-wrap", title: "טורטייה מלאה עם חזה עוף ואבוקדו", slots: ["lunch", "dinner"],
    parts: [{ food: "tortilla", qty: 1 }, { food: "chicken", qty: 100 }, { food: "avocado", qty: 30 }, salad], tip: "במקום מיונז: כף יוגורט עם לימון." },
  { slug: "pargit-couscous", title: "פרגיות בתנור עם קוסקוס וסלט", slots: ["lunch"],
    parts: [{ food: "pargit", qty: 130 }, { food: "couscous", qty: 150 }, salad] },
  { slug: "sabich-light", title: "סביח קליל: פיתה, ביצה, חציל וטחינה", slots: ["lunch", "dinner"],
    parts: [{ food: "pita", qty: 1 }, { food: "egg", qty: 1 }, { food: "cookedVeg", qty: 150, fixed: true }, { food: "tahini", qty: 1 }], tip: "החציל אפוי בתנור, לא מטוגן." },
  { slug: "chicken-buckwheat", title: "חזה עוף עם כוסמת וירקות", slots: ["lunch"],
    parts: [{ food: "chicken", qty: 130 }, { food: "buckwheat", qty: 150 }, { food: "cookedVeg", qty: 150, fixed: true }, { food: "oil", qty: 1 }] },
  { slug: "white-beans-rice", title: "תבשיל שעועית לבנה עם אורז", slots: ["lunch"],
    parts: [{ food: "whiteBeans", qty: 150 }, { food: "rice", qty: 125 }, salad] },
  { slug: "tabbouleh-chicken", title: "טבולה בורגול עם חזה עוף", slots: ["lunch"],
    parts: [{ food: "bulgur", qty: 150 }, { food: "chicken", qty: 100 }, salad, { food: "oil", qty: 1 }] },
  { slug: "salmon-bowl", title: "קערת סלמון, אורז ואדממה", slots: ["lunch"],
    parts: [{ food: "salmon", qty: 100 }, { food: "rice", qty: 125 }, { food: "edamame", qty: 75 }, sticks] },
  { slug: "meatballs-rice", title: "קציצות בקר ברוטב עגבניות עם אורז", slots: ["lunch"],
    parts: [{ food: "beef", qty: 120 }, { food: "tomatoSauce", qty: 100 }, { food: "rice", qty: 125 }] },
  { slug: "pasta-tofu-veg", title: "פסטה מלאה עם טופו וירקות", slots: ["lunch"],
    parts: [{ food: "pasta", qty: 150 }, { food: "tofu", qty: 100 }, { food: "cookedVeg", qty: 150, fixed: true }, { food: "oil", qty: 1 }] },
  { slug: "lentil-feta-salad", title: "סלט עדשים עם גבינה בולגרית", slots: ["lunch", "dinner"],
    parts: [{ food: "lentils", qty: 150 }, { food: "feta", qty: 50 }, salad, { food: "oil", qty: 1 }] },

  // ── Dinner ─────────────────────────────────────────────────
  { slug: "tuna-salad-bread", title: "סלט טונה עם לחם מלא", slots: ["dinner", "lunch"],
    parts: [{ food: "tuna", qty: 100 }, { food: "bread", qty: 2 }, salad, { food: "oil", qty: 1 }] },
  { slug: "omelette-cheese", title: "חביתה, גבינה לבנה וסלט", slots: ["dinner"],
    parts: [{ food: "egg", qty: 2 }, { food: "whiteCheese", qty: 50 }, { food: "bread", qty: 1 }, salad] },
  { slug: "lentil-soup", title: "מרק עדשים ולחם מלא", slots: ["dinner"],
    parts: [{ food: "lentilSoup", qty: 400 }, { food: "bread", qty: 1 }] },
  { slug: "salmon-veg", title: "סלמון עם ירקות מאודים", slots: ["dinner"],
    parts: [{ food: "salmon", qty: 120 }, { food: "cookedVeg", qty: 200, fixed: true }] },
  { slug: "tofu-stirfry", title: "טופו מוקפץ עם ירקות ואורז", slots: ["dinner", "lunch"],
    parts: [{ food: "tofu", qty: 125 }, { food: "cookedVeg", qty: 200, fixed: true }, { food: "rice", qty: 100 }, { food: "oil", qty: 1 }] },
  { slug: "quinoa-lentil-salad", title: "סלט קינואה ועדשים", slots: ["dinner", "lunch"],
    parts: [{ food: "quinoa", qty: 125 }, { food: "lentils", qty: 100 }, salad, { food: "oil", qty: 1 }] },
  { slug: "veg-soup-egg", title: "מרק ירקות, ביצה קשה ולחם מלא", slots: ["dinner"],
    parts: [{ food: "vegSoup", qty: 400 }, { food: "egg", qty: 1 }, { food: "bread", qty: 1 }] },
  { slug: "yogurt-bowl", title: "יוגורט חלבון עם פרי ואגוזים", slots: ["dinner", "breakfast"],
    parts: [{ food: "yogurt", qty: 200 }, { food: "fruit", qty: 1 }, { food: "walnuts", qty: 10 }] },
  { slug: "greek-salad", title: "סלט יווני עם בולגרית ופרוסת לחם", slots: ["dinner"],
    parts: [{ food: "feta", qty: 75 }, { food: "bread", qty: 1 }, salad, { food: "oil", qty: 1 }] },
  { slug: "chicken-veg-soup", title: "מרק ירקות עם חזה עוף", slots: ["dinner"],
    parts: [{ food: "vegSoup", qty: 400 }, { food: "chicken", qty: 80 }] },
  { slug: "fish-roast-veg", title: "פילה דג עם ירקות אפויים ופרוסת לחם", slots: ["dinner"],
    parts: [{ food: "whiteFish", qty: 150 }, { food: "cookedVeg", qty: 200, fixed: true }, { food: "bread", qty: 1 }] },
  { slug: "corn-egg-salad", title: "סלט ביצים ותירס עם פריכיות", slots: ["dinner"],
    parts: [{ food: "egg", qty: 2 }, { food: "cornCob", qty: 1 }, { food: "riceCake", qty: 2 }, salad], tip: "תירס מקלח או מקופסה, עם ביצים קצוצות וירקות." },
];
