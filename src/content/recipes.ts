/**
 * Initial recipe library (spec §10). Original, simple recipes written for this product.
 *
 * Nutrition values are deliberately NOT filled in here: they will be computed from a vetted
 * food-composition database (e.g. the Israeli Ministry of Health "Tzameret" dataset, subject
 * to its licence) once that import exists. Until then the app shows no calories for these
 * recipes rather than guessed numbers.
 *
 * Allergens follow the onboarding list. Oats are tagged gluten because of common cross-contact.
 * Every recipe ships as review_status = 'draft' and needs approval by a dietitian.
 */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type Allergen = "gluten" | "milk" | "egg" | "peanut" | "tree_nut" | "soy" | "fish" | "shellfish" | "sesame";
export type DietTag = "vegetarian" | "vegan" | "pescatarian" | "kosher_dairy" | "kosher_meat" | "kosher_parve";

export interface Ingredient {
  name_he: string;
  amount: number;
  unit: "g" | "ml" | "unit" | "tbsp" | "tsp" | "cup" | "pinch";
  optional?: boolean;
}

export interface RecipeSeed {
  slug: string;
  name_he: string;
  meal_type: MealType[];
  diet: DietTag[];
  allergens: Allergen[];
  prep_minutes: number;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
}

const veg: DietTag[] = ["vegetarian", "pescatarian"];
const vegan: DietTag[] = ["vegan", "vegetarian", "pescatarian"];

export const RECIPES: RecipeSeed[] = [
  // ── Breakfast ──────────────────────────────────────────────
  {
    slug: "yogurt-oats-fruit",
    name_he: "יוגורט עם שיבולת שועל ופרי",
    meal_type: ["breakfast", "snack"], diet: [...veg, "kosher_dairy"], allergens: ["milk", "gluten"],
    prep_minutes: 5, servings: 1,
    ingredients: [
      { name_he: "יוגורט טבעי", amount: 200, unit: "g" },
      { name_he: "שיבולת שועל", amount: 30, unit: "g" },
      { name_he: "פרי עונתי חתוך", amount: 100, unit: "g" },
      { name_he: "דבש או סילאן", amount: 1, unit: "tsp", optional: true },
    ],
    steps: ["שמים את היוגורט בקערה.", "מפזרים מעל שיבולת שועל ופרי.", "מוסיפים מעט דבש לפי הטעם."],
  },
  {
    slug: "shakshuka",
    name_he: "שקשוקה",
    meal_type: ["breakfast", "dinner"], diet: [...veg, "kosher_parve"], allergens: ["egg"],
    prep_minutes: 20, servings: 2,
    ingredients: [
      { name_he: "שמן זית", amount: 1, unit: "tbsp" },
      { name_he: "בצל קצוץ", amount: 1, unit: "unit" },
      { name_he: "פלפל אדום פרוס", amount: 1, unit: "unit" },
      { name_he: "שן שום", amount: 2, unit: "unit" },
      { name_he: "עגבניות מרוסקות", amount: 400, unit: "g" },
      { name_he: "ביצים", amount: 4, unit: "unit" },
      { name_he: "פפריקה וכמון", amount: 1, unit: "tsp" },
    ],
    steps: ["מטגנים בצל ופלפל בשמן עד שמתרככים.", "מוסיפים שום, תבלינים ועגבניות ומבשלים 8 דקות.", "שוברים את הביצים לתוך הרוטב, מכסים ומבשלים עד שהחלבון מתקשה."],
  },
  {
    slug: "cottage-toast-veg",
    name_he: "טוסט מלא עם קוטג׳ וירקות",
    meal_type: ["breakfast", "snack"], diet: [...veg, "kosher_dairy"], allergens: ["gluten", "milk"],
    prep_minutes: 5, servings: 1,
    ingredients: [
      { name_he: "פרוסות לחם מלא", amount: 2, unit: "unit" },
      { name_he: "גבינת קוטג׳", amount: 100, unit: "g" },
      { name_he: "מלפפון ועגבנייה פרוסים", amount: 120, unit: "g" },
    ],
    steps: ["קולים את הלחם.", "מורחים קוטג׳ ומניחים ירקות פרוסים מעל."],
  },
  {
    slug: "veg-omelet",
    name_he: "חביתת ירקות",
    meal_type: ["breakfast", "dinner"], diet: [...veg, "kosher_parve"], allergens: ["egg"],
    prep_minutes: 10, servings: 1,
    ingredients: [
      { name_he: "ביצים", amount: 2, unit: "unit" },
      { name_he: "תרד או עלים ירוקים", amount: 40, unit: "g" },
      { name_he: "פטריות פרוסות", amount: 60, unit: "g" },
      { name_he: "שמן זית", amount: 1, unit: "tsp" },
    ],
    steps: ["מקפיצים את הירקות במחבת עם מעט שמן.", "טורפים את הביצים ושופכים מעל.", "מבשלים על אש בינונית עד שהחביתה מתייצבת."],
  },
  {
    slug: "overnight-oats-tahini",
    name_he: "שיבולת שועל ללילה עם טחינה ובננה",
    meal_type: ["breakfast"], diet: [...vegan, "kosher_parve"], allergens: ["gluten", "sesame"],
    prep_minutes: 5, servings: 1,
    ingredients: [
      { name_he: "שיבולת שועל", amount: 40, unit: "g" },
      { name_he: "משקה שיבולת שועל או מים", amount: 150, unit: "ml" },
      { name_he: "טחינה גולמית", amount: 1, unit: "tbsp" },
      { name_he: "בננה פרוסה", amount: 1, unit: "unit" },
      { name_he: "קינמון", amount: 1, unit: "pinch" },
    ],
    steps: ["מערבבים שיבולת שועל, נוזל וקינמון בצנצנת.", "מקררים לפחות 4 שעות או לילה.", "בבוקר מוסיפים בננה וטחינה."],
  },
  {
    slug: "tofu-scramble",
    name_he: "טופו מקושקש",
    meal_type: ["breakfast", "dinner"], diet: [...vegan, "kosher_parve"], allergens: ["soy"],
    prep_minutes: 12, servings: 1,
    ingredients: [
      { name_he: "טופו קשה מפורר", amount: 150, unit: "g" },
      { name_he: "כורכום", amount: 0.5, unit: "tsp" },
      { name_he: "בצל ירוק קצוץ", amount: 2, unit: "unit" },
      { name_he: "שמן זית", amount: 1, unit: "tsp" },
    ],
    steps: ["מחממים שמן ומוסיפים את הטופו המפורר.", "מוסיפים כורכום ומלח ומערבבים 5 דקות.", "מפזרים בצל ירוק לפני ההגשה."],
  },

  // ── Lunch / dinner ─────────────────────────────────────────
  {
    slug: "chicken-quinoa-salad",
    name_he: "סלט קינואה עם חזה עוף",
    meal_type: ["lunch", "dinner"], diet: ["kosher_meat"], allergens: [],
    prep_minutes: 25, servings: 2,
    ingredients: [
      { name_he: "חזה עוף", amount: 300, unit: "g" },
      { name_he: "קינואה", amount: 100, unit: "g" },
      { name_he: "מלפפון, עגבנייה ופטרוזיליה קצוצים", amount: 250, unit: "g" },
      { name_he: "לימון", amount: 1, unit: "unit" },
      { name_he: "שמן זית", amount: 1, unit: "tbsp" },
    ],
    steps: ["מבשלים את הקינואה לפי ההוראות ומצננים.", "צולים את חזה העוף במחבת 5–6 דקות מכל צד עד שהוא מבושל לגמרי, ופורסים.", "מערבבים עם הירקות, לימון ושמן זית."],
  },
  {
    slug: "lentil-soup",
    name_he: "מרק עדשים כתומות",
    meal_type: ["lunch", "dinner"], diet: [...vegan, "kosher_parve"], allergens: [],
    prep_minutes: 35, servings: 4,
    ingredients: [
      { name_he: "עדשים כתומות", amount: 250, unit: "g" },
      { name_he: "בצל", amount: 1, unit: "unit" },
      { name_he: "גזר", amount: 2, unit: "unit" },
      { name_he: "כמון וכורכום", amount: 1, unit: "tsp" },
      { name_he: "מים", amount: 1200, unit: "ml" },
      { name_he: "לימון", amount: 0.5, unit: "unit" },
    ],
    steps: ["מטגנים בצל קצוץ, מוסיפים גזר ותבלינים.", "מוסיפים עדשים שטופות ומים ומבשלים 25 דקות.", "טוחנים חלקית וסוחטים לימון לפני ההגשה."],
  },
  {
    slug: "baked-salmon-veg",
    name_he: "סלמון אפוי עם ירקות",
    meal_type: ["lunch", "dinner"], diet: ["pescatarian", "kosher_parve"], allergens: ["fish"],
    prep_minutes: 25, servings: 2,
    ingredients: [
      { name_he: "פילה סלמון", amount: 300, unit: "g" },
      { name_he: "ברוקולי וקישואים", amount: 400, unit: "g" },
      { name_he: "שמן זית", amount: 1, unit: "tbsp" },
      { name_he: "לימון", amount: 1, unit: "unit" },
    ],
    steps: ["מחממים תנור ל-200 מעלות.", "מסדרים סלמון וירקות בתבנית, מזלפים שמן ומתבלים.", "אופים כ-15 דקות עד שהדג מבושל."],
  },
  {
    slug: "turkey-meatballs-tomato",
    name_he: "קציצות הודו ברוטב עגבניות",
    meal_type: ["lunch", "dinner"], diet: ["kosher_meat"], allergens: ["egg"],
    prep_minutes: 35, servings: 4,
    ingredients: [
      { name_he: "הודו טחון", amount: 500, unit: "g" },
      { name_he: "ביצה", amount: 1, unit: "unit" },
      { name_he: "בצל מגורר", amount: 1, unit: "unit" },
      { name_he: "פטרוזיליה קצוצה", amount: 20, unit: "g" },
      { name_he: "עגבניות מרוסקות", amount: 400, unit: "g" },
    ],
    steps: ["מערבבים הודו, ביצה, בצל ופטרוזיליה ויוצרים קציצות.", "מביאים את הרוטב לרתיחה ומכניסים את הקציצות.", "מבשלים על אש נמוכה 20 דקות עם מכסה."],
  },
  {
    slug: "chickpea-veg-stew",
    name_he: "תבשיל חומוס וירקות",
    meal_type: ["lunch", "dinner"], diet: [...vegan, "kosher_parve"], allergens: [],
    prep_minutes: 30, servings: 3,
    ingredients: [
      { name_he: "גרגירי חומוס מבושלים", amount: 400, unit: "g" },
      { name_he: "בטטה בקוביות", amount: 1, unit: "unit" },
      { name_he: "תרד", amount: 100, unit: "g" },
      { name_he: "עגבניות מרוסקות", amount: 400, unit: "g" },
      { name_he: "כמון ופפריקה", amount: 1, unit: "tsp" },
    ],
    steps: ["מבשלים בטטה עם עגבניות ותבלינים 15 דקות.", "מוסיפים חומוס ומבשלים עוד 10 דקות.", "מוסיפים תרד בסוף ומערבבים עד שהוא נובל."],
  },
  {
    slug: "tuna-pasta-salad",
    name_he: "סלט פסטה מלאה עם טונה",
    meal_type: ["lunch"], diet: ["pescatarian", "kosher_parve"], allergens: ["gluten", "fish"],
    prep_minutes: 15, servings: 2,
    ingredients: [
      { name_he: "פסטה מקמח מלא", amount: 150, unit: "g" },
      { name_he: "טונה במים", amount: 1, unit: "unit" },
      { name_he: "תירס, עגבניות שרי ובצל סגול", amount: 200, unit: "g" },
      { name_he: "שמן זית ולימון", amount: 1, unit: "tbsp" },
    ],
    steps: ["מבשלים את הפסטה ומצננים.", "מערבבים עם טונה מסוננת וירקות.", "מתבלים בשמן זית, לימון ומלח."],
  },
  {
    slug: "tofu-rice-stirfry",
    name_he: "מוקפץ טופו וירקות עם אורז",
    meal_type: ["lunch", "dinner"], diet: [...vegan, "kosher_parve"], allergens: ["soy"],
    prep_minutes: 25, servings: 2,
    ingredients: [
      { name_he: "טופו קשה בקוביות", amount: 250, unit: "g" },
      { name_he: "ירקות להקפצה", amount: 300, unit: "g" },
      { name_he: "אורז מלא מבושל", amount: 300, unit: "g" },
      { name_he: "רוטב סויה", amount: 2, unit: "tbsp" },
    ],
    steps: ["משחימים את הטופו במחבת חמה עם מעט שמן.", "מוסיפים ירקות ומקפיצים 5 דקות.", "מוסיפים רוטב סויה ומגישים עם האורז."],
  },
  {
    slug: "chicken-pita-salad",
    name_he: "פיתה מלאה עם עוף וסלט",
    meal_type: ["lunch"], diet: ["kosher_meat"], allergens: ["gluten", "sesame"],
    prep_minutes: 20, servings: 1,
    ingredients: [
      { name_he: "פיתה מקמח מלא", amount: 1, unit: "unit" },
      { name_he: "רצועות חזה עוף צלויות", amount: 120, unit: "g" },
      { name_he: "סלט ירקות קצוץ", amount: 100, unit: "g" },
      { name_he: "טחינה", amount: 1, unit: "tbsp" },
    ],
    steps: ["צולים את העוף במחבת עד שהוא מבושל לגמרי.", "ממלאים את הפיתה בעוף וסלט.", "מוסיפים טחינה."],
  },
  {
    slug: "stuffed-peppers-rice",
    name_he: "פלפלים ממולאים באורז ועדשים",
    meal_type: ["dinner"], diet: [...vegan, "kosher_parve"], allergens: [],
    prep_minutes: 60, servings: 4,
    ingredients: [
      { name_he: "פלפלים", amount: 4, unit: "unit" },
      { name_he: "אורז", amount: 150, unit: "g" },
      { name_he: "עדשים ירוקות מבושלות", amount: 200, unit: "g" },
      { name_he: "רסק עגבניות", amount: 2, unit: "tbsp" },
    ],
    steps: ["חותכים מכסה לפלפלים ומנקים.", "מערבבים אורז, עדשים, רסק ותבלינים וממלאים.", "מסדרים בסיר עם מעט מים ומבשלים מכוסה 45 דקות."],
  },

  // ── Snacks ─────────────────────────────────────────────────
  {
    slug: "hummus-veg-sticks",
    name_he: "חומוס עם מקלות ירקות",
    meal_type: ["snack"], diet: [...vegan, "kosher_parve"], allergens: ["sesame"],
    prep_minutes: 5, servings: 1,
    ingredients: [
      { name_he: "חומוס מוכן", amount: 60, unit: "g" },
      { name_he: "גזר, מלפפון ופלפל חתוכים", amount: 150, unit: "g" },
    ],
    steps: ["חותכים את הירקות למקלות.", "מגישים עם החומוס."],
  },
  {
    slug: "apple-peanut-butter",
    name_he: "תפוח עם חמאת בוטנים",
    meal_type: ["snack"], diet: [...vegan, "kosher_parve"], allergens: ["peanut"],
    prep_minutes: 3, servings: 1,
    ingredients: [
      { name_he: "תפוח", amount: 1, unit: "unit" },
      { name_he: "חמאת בוטנים טבעית", amount: 1, unit: "tbsp" },
    ],
    steps: ["פורסים את התפוח.", "מגישים עם חמאת הבוטנים."],
  },
  {
    slug: "nuts-dates",
    name_he: "חופן אגוזים ותמרים",
    meal_type: ["snack"], diet: [...vegan, "kosher_parve"], allergens: ["tree_nut"],
    prep_minutes: 1, servings: 1,
    ingredients: [
      { name_he: "אגוזים לא קלויים", amount: 25, unit: "g" },
      { name_he: "תמרים", amount: 2, unit: "unit" },
    ],
    steps: ["מגישים יחד."],
  },
  {
    slug: "hard-boiled-eggs",
    name_he: "ביצים קשות עם עגבנייה",
    meal_type: ["snack", "breakfast"], diet: [...veg, "kosher_parve"], allergens: ["egg"],
    prep_minutes: 12, servings: 1,
    ingredients: [
      { name_he: "ביצים", amount: 2, unit: "unit" },
      { name_he: "עגבנייה", amount: 1, unit: "unit" },
    ],
    steps: ["מבשלים את הביצים 10 דקות במים רותחים.", "מקררים, מקלפים ומגישים עם עגבנייה פרוסה."],
  },
  {
    slug: "cottage-fruit",
    name_he: "קוטג׳ עם פרי",
    meal_type: ["snack"], diet: [...veg, "kosher_dairy"], allergens: ["milk"],
    prep_minutes: 2, servings: 1,
    ingredients: [
      { name_he: "גבינת קוטג׳", amount: 150, unit: "g" },
      { name_he: "פרי עונתי", amount: 100, unit: "g" },
    ],
    steps: ["מערבבים או מגישים זה לצד זה."],
  },
  {
    slug: "edamame",
    name_he: "אדממה מאודה",
    meal_type: ["snack"], diet: [...vegan, "kosher_parve"], allergens: ["soy"],
    prep_minutes: 6, servings: 1,
    ingredients: [{ name_he: "אדממה קפואה בתרמילים", amount: 150, unit: "g" }],
    steps: ["מאדים או מבשלים 5 דקות.", "מפזרים מעט מלח גס."],
  },
  {
    slug: "fruit-plate",
    name_he: "צלחת פירות",
    meal_type: ["snack"], diet: [...vegan, "kosher_parve"], allergens: [],
    prep_minutes: 3, servings: 1,
    ingredients: [{ name_he: "פירות עונתיים", amount: 200, unit: "g" }],
    steps: ["שוטפים, חותכים ומגישים."],
  },
];
