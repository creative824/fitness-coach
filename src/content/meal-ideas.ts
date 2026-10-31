/**
 * Meal ideas library (replaces recipes by product decision).
 *
 * The product does not give recipes. It suggests simple ideas at the level of
 * "small breakfast: a vegetable salad with a handful of nuts". There are no amounts, no
 * cooking steps and no calorie counts. A test enforces that no text contains numbers or units.
 *
 * Allergens follow the onboarding list. Every idea ships as review_status = 'draft' and needs
 * approval by a dietitian before the plan engine may use it.
 */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type Portion = "light" | "regular";
export type Component = "protein" | "vegetables" | "carbs" | "fat" | "fruit";
export type Allergen = "gluten" | "milk" | "egg" | "peanut" | "tree_nut" | "soy" | "fish" | "shellfish" | "sesame";
export type DietTag = "vegetarian" | "vegan" | "pescatarian" | "kosher_dairy" | "kosher_meat" | "kosher_parve";

export interface MealIdeaSeed {
  slug: string;
  title_he: string;
  hint_he?: string;
  meal_type: MealType[];
  portion: Portion;
  components: Component[];
  diet: DietTag[];
  allergens: Allergen[];
}

const veg: DietTag[] = ["vegetarian", "pescatarian"];
const vegan: DietTag[] = ["vegan", "vegetarian", "pescatarian", "kosher_parve"];
const fishy: DietTag[] = ["pescatarian", "kosher_parve"];
const meat: DietTag[] = ["kosher_meat"];

export const MEAL_IDEAS: MealIdeaSeed[] = [
  // ── Breakfast ──────────────────────────────────────────────
  { slug: "salad-nuts", title_he: "סלט ירקות עם אגוזים", hint_he: "ירקות חתוכים וחופן אגוזים או שקדים",
    meal_type: ["breakfast", "dinner"], portion: "light", components: ["vegetables", "fat"], diet: vegan, allergens: ["tree_nut"] },
  { slug: "yogurt-fruit", title_he: "יוגורט עם פרי", hint_he: "יוגורט טבעי ופרי עונתי חתוך",
    meal_type: ["breakfast", "snack"], portion: "light", components: ["protein", "fruit"], diet: [...veg, "kosher_dairy"], allergens: ["milk"] },
  { slug: "yogurt-oats-fruit", title_he: "יוגורט עם שיבולת שועל ופרי",
    meal_type: ["breakfast"], portion: "regular", components: ["protein", "carbs", "fruit"], diet: [...veg, "kosher_dairy"], allergens: ["milk", "gluten"] },
  { slug: "omelette-veg", title_he: "חביתה עם ירקות", hint_he: "חביתה וסלט קטן לצד",
    meal_type: ["breakfast", "dinner"], portion: "light", components: ["protein", "vegetables"], diet: [...veg, "kosher_parve"], allergens: ["egg"] },
  { slug: "egg-salad-bread", title_he: "ביצה, סלט ופרוסת לחם מלא",
    meal_type: ["breakfast"], portion: "regular", components: ["protein", "vegetables", "carbs"], diet: [...veg, "kosher_parve"], allergens: ["egg", "gluten"] },
  { slug: "cheese-bread-veg", title_he: "לחם מלא עם גבינה לבנה וירקות",
    meal_type: ["breakfast", "dinner"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: [...veg, "kosher_dairy"], allergens: ["milk", "gluten"] },
  { slug: "avocado-toast", title_he: "טוסט מלא עם אבוקדו", hint_he: "אבוקדו מעוך ועגבנייה על פרוסת לחם מלא",
    meal_type: ["breakfast"], portion: "light", components: ["carbs", "fat", "vegetables"], diet: vegan, allergens: ["gluten"] },
  { slug: "oatmeal-fruit", title_he: "דייסת שיבולת שועל עם פרי", hint_he: "מבושלת במים, עם פרי חתוך מעל",
    meal_type: ["breakfast"], portion: "regular", components: ["carbs", "fruit"], diet: vegan, allergens: ["gluten"] },
  { slug: "shakshuka-salad", title_he: "שקשוקה עם סלט",
    meal_type: ["breakfast", "dinner"], portion: "regular", components: ["protein", "vegetables"], diet: [...veg, "kosher_parve"], allergens: ["egg"] },
  { slug: "tahini-bread-veg", title_he: "לחם מלא עם טחינה וירקות",
    meal_type: ["breakfast"], portion: "regular", components: ["carbs", "fat", "vegetables"], diet: vegan, allergens: ["gluten", "sesame"] },

  // ── Lunch ──────────────────────────────────────────────────
  { slug: "chicken-rice-salad", title_he: "חזה עוף, אורז וסלט",
    meal_type: ["lunch", "dinner"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: meat, allergens: [] },
  { slug: "legume-salad", title_he: "סלט ירקות עם קטניות", hint_he: "ירקות טריים עם עדשים או גרגרי חומוס",
    meal_type: ["lunch", "dinner"], portion: "light", components: ["protein", "vegetables"], diet: vegan, allergens: [] },
  { slug: "quinoa-tofu-bowl", title_he: "קערת קינואה עם ירקות וטופו",
    meal_type: ["lunch", "dinner"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: vegan, allergens: ["soy"] },
  { slug: "baked-fish-veg-potato", title_he: "דג אפוי עם ירקות ותפוחי אדמה",
    meal_type: ["lunch", "dinner"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: fishy, allergens: ["fish"] },
  { slug: "lentil-soup-bread", title_he: "מרק עדשים ופרוסת לחם מלא",
    meal_type: ["lunch", "dinner"], portion: "regular", components: ["protein", "carbs"], diet: vegan, allergens: ["gluten"] },
  { slug: "tuna-salad", title_he: "סלט ירקות עם טונה",
    meal_type: ["lunch", "dinner"], portion: "light", components: ["protein", "vegetables"], diet: fishy, allergens: ["fish"] },
  { slug: "pasta-tomato-veg", title_he: "פסטה מלאה ברוטב עגבניות וירקות",
    meal_type: ["lunch"], portion: "regular", components: ["carbs", "vegetables"], diet: vegan, allergens: ["gluten"] },
  { slug: "lean-meat-bulgur-salad", title_he: "בשר רזה, בורגול וסלט",
    meal_type: ["lunch"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: meat, allergens: ["gluten"] },
  { slug: "pita-hummus-salad", title_he: "פיתה מלאה עם חומוס מוכן וסלט",
    meal_type: ["lunch"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: vegan, allergens: ["gluten", "sesame"] },
  { slug: "salad-boiled-egg", title_he: "סלט ירקות עם ביצה קשה",
    meal_type: ["lunch", "dinner"], portion: "light", components: ["protein", "vegetables"], diet: [...veg, "kosher_parve"], allergens: ["egg"] },
  { slug: "rice-legumes-veg", title_he: "אורז עם קטניות וירקות מבושלים",
    meal_type: ["lunch"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: vegan, allergens: [] },

  // ── Dinner ─────────────────────────────────────────────────
  { slug: "veg-soup", title_he: "מרק ירקות",
    meal_type: ["dinner"], portion: "light", components: ["vegetables"], diet: vegan, allergens: [] },
  { slug: "roast-chicken-veg", title_he: "עוף צלוי עם ירקות אפויים",
    meal_type: ["dinner"], portion: "regular", components: ["protein", "vegetables"], diet: meat, allergens: [] },
  { slug: "salmon-steamed-veg", title_he: "סלמון עם ירקות מאודים",
    meal_type: ["dinner"], portion: "regular", components: ["protein", "vegetables", "fat"], diet: fishy, allergens: ["fish"] },
  { slug: "tofu-stirfry-rice", title_he: "טופו מוקפץ עם ירקות ואורז",
    meal_type: ["dinner"], portion: "regular", components: ["protein", "carbs", "vegetables"], diet: vegan, allergens: ["soy"] },
  { slug: "quinoa-salad-nuts", title_he: "סלט קינואה עם ירקות ואגוזים",
    meal_type: ["dinner", "lunch"], portion: "light", components: ["carbs", "vegetables", "fat"], diet: vegan, allergens: ["tree_nut"] },
  { slug: "cottage-veg", title_he: "גבינה לבנה עם ירקות חתוכים",
    meal_type: ["dinner"], portion: "light", components: ["protein", "vegetables"], diet: [...veg, "kosher_dairy"], allergens: ["milk"] },
  { slug: "roasted-veg-legumes", title_he: "ירקות אפויים עם קטניות",
    meal_type: ["dinner"], portion: "regular", components: ["protein", "vegetables"], diet: vegan, allergens: [] },

  // ── Snacks ─────────────────────────────────────────────────
  { slug: "seasonal-fruit", title_he: "פרי עונתי",
    meal_type: ["snack"], portion: "light", components: ["fruit"], diet: vegan, allergens: [] },
  { slug: "handful-nuts", title_he: "חופן אגוזים או שקדים",
    meal_type: ["snack"], portion: "light", components: ["fat"], diet: vegan, allergens: ["tree_nut"] },
  { slug: "veg-sticks-hummus", title_he: "מקלות ירקות עם חומוס מוכן", hint_he: "גזר, מלפפון ופלפל",
    meal_type: ["snack"], portion: "light", components: ["vegetables", "protein"], diet: vegan, allergens: ["sesame"] },
  { slug: "apple-peanut-butter", title_he: "תפוח עם מעט חמאת בוטנים",
    meal_type: ["snack"], portion: "light", components: ["fruit", "fat"], diet: vegan, allergens: ["peanut"] },
  { slug: "boiled-egg", title_he: "ביצה קשה",
    meal_type: ["snack"], portion: "light", components: ["protein"], diet: [...veg, "kosher_parve"], allergens: ["egg"] },
  { slug: "rice-cake-cheese", title_he: "פריכיות אורז עם גבינה לבנה",
    meal_type: ["snack"], portion: "light", components: ["carbs", "protein"], diet: [...veg, "kosher_dairy"], allergens: ["milk"] },
  { slug: "fruit-and-almonds", title_he: "פרי וכמה שקדים",
    meal_type: ["snack", "breakfast"], portion: "light", components: ["fruit", "fat"], diet: vegan, allergens: ["tree_nut"] },
];
