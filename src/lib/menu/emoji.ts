/**
 * A friendly picture for a meal, from the words in its title, so the menu reads at a glance.
 * Falls back to one per meal of the day. Pure.
 */
const BY_WORD: [RegExp, string][] = [
  [/חביתה|ביצ|שקשוקה/, "🍳"],
  [/שיבולת|דייסה|גרנולה|קורנפלקס|דגני/, "🥣"],
  [/יוגורט|קוטג|גבינה לבנה|סקייר|מעדן/, "🥛"],
  [/סלט/, "🥗"],
  [/פיתה|כריך|טוסט|לחם|לחמני|באגט|טורטי|ראפ/, "🥪"],
  [/עוף|חזה|פרגית|שניצל|הודו/, "🍗"],
  [/דג|סלמון|טונה|אמנון|לברק/, "🐟"],
  [/בשר|בקר|קציצ|המבורגר/, "🥩"],
  [/פסטה|ספגטי|לזניה|אטריות/, "🍝"],
  [/אורז|קינואה|קוסקוס|בורגול|פתיתים|ממולא/, "🍚"],
  [/מרק/, "🍲"],
  [/טופו|עדשים|חומוס|שעועית|קטניות|פלאפל/, "🫘"],
  [/תפוח|בננה|פירות|פרי|ענבים|תותים|אבטיח|תמר/, "🍎"],
  [/אגוז|שקדים|בוטנים|קשיו/, "🥜"],
  [/שייק|סמותי/, "🥤"],
  [/ירקות|מקלות/, "🥕"],
  [/פנקייק|פנקיק|וופל/, "🥞"],
  [/אבוקדו/, "🥑"],
];

const BY_SLOT: Record<string, string> = { breakfast: "🍳", snack: "🍎", lunch: "🍲", dinner: "🥗" };

export function mealEmoji(title: string, slot: string): string {
  for (const [re, e] of BY_WORD) if (re.test(title)) return e;
  return BY_SLOT[slot] ?? "🍽️";
}
