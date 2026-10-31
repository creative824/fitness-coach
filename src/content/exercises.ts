/**
 * Initial exercise library (spec §11). Original wording written for this product.
 * Every entry ships as review_status = 'draft' and must be approved by a qualified trainer
 * in the admin screen before the plan engine may use it.
 *
 * contraindications: tags the plan engine uses to skip an exercise for a user who reported
 * a related limitation (knee, shoulder, lower_back, wrist, neck) or a safety flag
 * (high_impact → pregnancy / low intensity, supine → avoid long lying on the back in pregnancy).
 */
import type { MuscleId } from "./muscles";

export type Equipment = "none" | "mat" | "dumbbells" | "kettlebell" | "bands" | "pullup_bar" | "bench" | "machines" | "barbell";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Category = "strength" | "cardio" | "mobility" | "core";
export type Mode = "reps" | "seconds";
export type Contra = "knee" | "shoulder" | "lower_back" | "wrist" | "neck" | "high_impact" | "supine";

export interface ExerciseSeed {
  slug: string;
  name_he: string;
  category: Category;
  mode: Mode;
  difficulty: Difficulty;
  equipment: Equipment[]; // all items required; empty = bodyweight
  primary: MuscleId[];
  secondary: MuscleId[];
  steps: string[];
  cautions: string;
  contraindications: Contra[];
  easier?: string; // slug of a regression
}

export const EXERCISES: ExerciseSeed[] = [
  // ── Lower body ─────────────────────────────────────────────
  {
    slug: "bodyweight-squat",
    name_he: "סקוואט במשקל גוף",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: [],
    primary: ["quads", "glutes"], secondary: ["abs", "adductors"],
    steps: ["עומדים ברוחב כתפיים, כפות הרגליים פונות מעט החוצה.", "יורדים לאחור כאילו מתיישבים על כיסא, הברכיים בכיוון האצבעות.", "יורדים עד טווח נוח עם גב ניטרלי, ועולים בדחיפה דרך כל כף הרגל."],
    cautions: "אם יש כאב בברך, מקצרים את הטווח או עוברים לישיבה וקימה מכיסא.",
    contraindications: ["knee"], easier: "sit-to-stand",
  },
  {
    slug: "sit-to-stand",
    name_he: "קימה מכיסא",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: [],
    primary: ["quads", "glutes"], secondary: ["abs"],
    steps: ["יושבים בקצה כיסא יציב, כפות הרגליים על הרצפה.", "נוטים מעט קדימה וקמים בלי להיעזר בידיים.", "מתיישבים לאט ובשליטה."],
    cautions: "משתמשים בכיסא שלא זז. אפשר להיעזר בידיים בהתחלה.",
    contraindications: [],
  },
  {
    slug: "goblet-squat",
    name_he: "סקוואט גביע",
    category: "strength", mode: "reps", difficulty: "intermediate", equipment: ["dumbbells"],
    primary: ["quads", "glutes"], secondary: ["abs", "upper_back", "adductors"],
    steps: ["מחזיקים משקולת אחת אנכית צמוד לחזה.", "יורדים לסקוואט כשהמרפקים בין הברכיים והחזה זקוף.", "עולים בדחיפה דרך העקבים."],
    cautions: "בוחרים משקל שמאפשר לשמור על גב ניטרלי לאורך כל הסט.",
    contraindications: ["knee"], easier: "bodyweight-squat",
  },
  {
    slug: "reverse-lunge",
    name_he: "לאנג׳ לאחור",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: [],
    primary: ["quads", "glutes"], secondary: ["hamstrings", "abs", "adductors"],
    steps: ["עומדים זקוף, ידיים על המותניים.", "צועדים צעד גדול לאחור ומורידים את הברך האחורית לכיוון הרצפה.", "חוזרים לעמידה בדחיפה דרך הרגל הקדמית. מחליפים צד."],
    cautions: "לשיווי משקל אפשר להחזיק קיר או משענת.",
    contraindications: ["knee"], easier: "sit-to-stand",
  },
  {
    slug: "glute-bridge",
    name_he: "גשר ישבן",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["mat"],
    primary: ["glutes"], secondary: ["hamstrings", "lower_back", "abs"],
    steps: ["שוכבים על הגב, ברכיים כפופות וכפות רגליים על הרצפה.", "מרימים את האגן עד קו ישר בין הכתפיים לברכיים, מכווצים את הישבן.", "מחזיקים שנייה ויורדים לאט."],
    cautions: "לא מקשתים את הגב התחתון בחלק העליון של התנועה.",
    contraindications: ["supine"],
  },
  {
    slug: "romanian-deadlift-db",
    name_he: "דדליפט רומני עם משקולות",
    category: "strength", mode: "reps", difficulty: "intermediate", equipment: ["dumbbells"],
    primary: ["hamstrings", "glutes"], secondary: ["lower_back", "abs", "forearms"],
    steps: ["עומדים עם משקולת בכל יד מול הירכיים, ברכיים מעט כפופות.", "דוחפים את האגן לאחור ומורידים את המשקולות לאורך הרגליים, גב ישר.", "יורדים עד מתיחה באחורי הירך וחוזרים בכיווץ הישבן."],
    cautions: "הגב נשאר ניטרלי לאורך כל התנועה. אם הגב מתעגל, מקצרים את הטווח.",
    contraindications: ["lower_back"], easier: "glute-bridge",
  },
  {
    slug: "step-up",
    name_he: "עלייה על מדרגה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: [],
    primary: ["quads", "glutes"], secondary: ["calves", "hamstrings"],
    steps: ["עומדים מול מדרגה או ספסל נמוך ויציב.", "עולים עם רגל אחת בדחיפה דרך העקב עד עמידה מלאה.", "יורדים בשליטה. משלימים את כל החזרות ומחליפים רגל."],
    cautions: "גובה המדרגה כך שהברך לא עולה מעל גובה הירך.",
    contraindications: ["knee"],
  },
  {
    slug: "calf-raise",
    name_he: "הרמות עקבים",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: [],
    primary: ["calves"], secondary: [],
    steps: ["עומדים ליד קיר, כפות רגליים ברוחב אגן.", "עולים על קצות האצבעות לאט.", "מחזיקים שנייה ויורדים בשליטה."],
    cautions: "אפשר להיעזר בקיר לשיווי משקל.",
    contraindications: [],
  },
  {
    slug: "wall-sit",
    name_he: "ישיבה על קיר",
    category: "strength", mode: "seconds", difficulty: "beginner", equipment: [],
    primary: ["quads"], secondary: ["glutes", "abs"],
    steps: ["נשענים עם הגב על קיר ומחליקים מטה.", "עוצרים בזווית נוחה, הברכיים מעל הקרסוליים.", "מחזיקים את הזמן ונושמים באופן רגיל."],
    cautions: "לא יורדים מתחת ל-90 מעלות בברך. עוצרים אם יש כאב בברך.",
    contraindications: ["knee"],
  },
  {
    slug: "kettlebell-swing",
    name_he: "סווינג קטלבל",
    category: "strength", mode: "reps", difficulty: "advanced", equipment: ["kettlebell"],
    primary: ["glutes", "hamstrings"], secondary: ["lower_back", "abs", "shoulders", "forearms"],
    steps: ["עומדים מעט רחב מהכתפיים, הקטלבל לפניכם על הרצפה.", "מושכים אותו לאחור בין הרגליים בכפיפת אגן, גב ישר.", "מיישרים את האגן בעוצמה כך שהקטלבל עולה לגובה החזה, והזרועות רק מכוונות."],
    cautions: "התנועה מגיעה מהאגן ולא מהזרועות. מומלץ ללמוד עם מאמן לפני שמוסיפים משקל.",
    contraindications: ["lower_back", "high_impact"], easier: "glute-bridge",
  },
  {
    slug: "barbell-back-squat",
    name_he: "סקוואט עם מוט",
    category: "strength", mode: "reps", difficulty: "advanced", equipment: ["barbell"],
    primary: ["quads", "glutes"], secondary: ["lower_back", "abs", "adductors", "hamstrings"],
    steps: ["מניחים את המוט על הגב העליון ויוצאים מהמתקן בשני צעדים.", "נושמים, מהדקים את הבטן ויורדים בשליטה.", "עולים בדחיפה דרך כל כף הרגל ונושפים למעלה."],
    cautions: "מתאמנים עם מעצורי ביטחון במתקן. לא מעמיסים לפני שהטכניקה יציבה.",
    contraindications: ["knee", "lower_back"], easier: "goblet-squat",
  },
  {
    slug: "leg-press",
    name_he: "לחיצת רגליים במכונה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["machines"],
    primary: ["quads", "glutes"], secondary: ["hamstrings", "calves"],
    steps: ["יושבים במכונה, כפות הרגליים ברוחב כתפיים על הפלטה.", "משחררים את הנעילה ומורידים את הפלטה בשליטה.", "דוחפים חזרה בלי לנעול את הברכיים לגמרי."],
    cautions: "הגב התחתון נשאר צמוד למשענת לאורך כל התנועה.",
    contraindications: ["knee"],
  },

  // ── Upper body push ────────────────────────────────────────
  {
    slug: "wall-push-up",
    name_he: "שכיבת סמיכה על קיר",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: [],
    primary: ["chest"], secondary: ["triceps", "shoulders"],
    steps: ["עומדים מול קיר במרחק זרוע, כפות הידיים על הקיר בגובה הכתפיים.", "מקרבים את החזה לקיר כשהגוף ישר.", "דוחפים חזרה."],
    cautions: "ככל שעומדים רחוק יותר מהקיר, התרגיל קשה יותר.",
    contraindications: [],
  },
  {
    slug: "knee-push-up",
    name_he: "שכיבת סמיכה על הברכיים",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["mat"],
    primary: ["chest"], secondary: ["triceps", "shoulders", "abs"],
    steps: ["נשענים על כפות הידיים והברכיים, ידיים מעט רחב מהכתפיים.", "יוצרים קו ישר מהברכיים לראש.", "מורידים את החזה לכיוון הרצפה ודוחפים חזרה."],
    cautions: "אם יש כאב בשורש כף היד, אפשר להישען על אגרופים או על ידיות.",
    contraindications: ["wrist"], easier: "wall-push-up",
  },
  {
    slug: "push-up",
    name_he: "שכיבת סמיכה",
    category: "strength", mode: "reps", difficulty: "intermediate", equipment: [],
    primary: ["chest"], secondary: ["triceps", "shoulders", "abs"],
    steps: ["נשענים על כפות הידיים והאצבעות, גוף ישר מהראש לעקבים.", "מורידים את החזה לכיוון הרצפה, מרפקים בזווית של כ-45 מעלות מהגוף.", "דוחפים חזרה בלי לתת לאגן לשקוע."],
    cautions: "אם האגן שוקע, עוברים לגרסה על הברכיים.",
    contraindications: ["wrist", "shoulder"], easier: "knee-push-up",
  },
  {
    slug: "db-floor-press",
    name_he: "לחיצת חזה מהרצפה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["dumbbells", "mat"],
    primary: ["chest"], secondary: ["triceps", "shoulders"],
    steps: ["שוכבים על הגב עם משקולת בכל יד, מרפקים על הרצפה.", "דוחפים את המשקולות מעלה עד יישור הזרועות.", "מורידים לאט עד שהמרפקים נוגעים ברצפה."],
    cautions: "הרצפה מגבילה את הטווח, ולכן התרגיל ידידותי לכתפיים.",
    contraindications: ["supine"],
  },
  {
    slug: "db-bench-press",
    name_he: "לחיצת חזה על ספסל",
    category: "strength", mode: "reps", difficulty: "intermediate", equipment: ["dumbbells", "bench"],
    primary: ["chest"], secondary: ["triceps", "shoulders"],
    steps: ["שוכבים על ספסל, משקולות מעל החזה.", "מורידים בשליטה עד גובה החזה, מרפקים מעט פנימה.", "דוחפים חזרה מעלה."],
    cautions: "כפות הרגליים יציבות על הרצפה והגב העליון צמוד לספסל.",
    contraindications: ["shoulder", "supine"], easier: "db-floor-press",
  },
  {
    slug: "db-shoulder-press",
    name_he: "לחיצת כתפיים",
    category: "strength", mode: "reps", difficulty: "intermediate", equipment: ["dumbbells"],
    primary: ["shoulders"], secondary: ["triceps", "abs"],
    steps: ["עומדים או יושבים, משקולות בגובה הכתפיים.", "דוחפים מעלה עד יישור הזרועות בלי לקשת את הגב.", "מורידים בשליטה לגובה הכתפיים."],
    cautions: "מהדקים את הבטן. אם יש כאב בכתף מעל הראש, מקצרים את הטווח.",
    contraindications: ["shoulder"],
  },
  {
    slug: "bench-dip",
    name_he: "מקבילים על ספסל",
    category: "strength", mode: "reps", difficulty: "intermediate", equipment: ["bench"],
    primary: ["triceps"], secondary: ["chest", "shoulders"],
    steps: ["יושבים בקצה ספסל, ידיים לצד הירכיים, ומחליקים קדימה.", "מכופפים מרפקים עד כ-90 מעלות.", "דוחפים חזרה מעלה."],
    cautions: "לא יורדים עמוק מדי. מתאים פחות למי שיש לו רגישות בכתף.",
    contraindications: ["shoulder", "wrist"],
  },
  {
    slug: "band-triceps-pushdown",
    name_he: "פשיטת מרפקים עם גומייה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["bands"],
    primary: ["triceps"], secondary: [],
    steps: ["קושרים גומייה בנקודה גבוהה ואוחזים בקצוות.", "מרפקים צמודים לגוף, מיישרים את הזרועות מטה.", "חוזרים לאט."],
    cautions: "רק האמה זזה. המרפקים נשארים במקום.",
    contraindications: [],
  },

  // ── Upper body pull ────────────────────────────────────────
  {
    slug: "db-row",
    name_he: "חתירה עם משקולת",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["dumbbells"],
    primary: ["upper_back"], secondary: ["biceps", "shoulders", "forearms"],
    steps: ["נשענים ביד אחת על ספסל או כיסא, גב ישר.", "מושכים את המשקולת לכיוון המותן, המרפק צמוד לגוף.", "מורידים בשליטה. מחליפים צד."],
    cautions: "הגב לא מסתובב בזמן המשיכה.",
    contraindications: [],
  },
  {
    slug: "band-row",
    name_he: "חתירה עם גומייה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["bands"],
    primary: ["upper_back"], secondary: ["biceps", "shoulders"],
    steps: ["קושרים גומייה בגובה החזה ועומדים מולה.", "מושכים את הידיות לכיוון הצלעות ומקרבים את השכמות.", "משחררים לאט."],
    cautions: "הכתפיים נשארות רחוקות מהאוזניים.",
    contraindications: [],
  },
  {
    slug: "band-pull-apart",
    name_he: "פתיחת גומייה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["bands"],
    primary: ["upper_back"], secondary: ["shoulders"],
    steps: ["מחזיקים גומייה מול החזה בזרועות ישרות.", "פותחים את הזרועות לצדדים עד שהגומייה נוגעת בחזה.", "חוזרים לאט."],
    cautions: "תרגיל טוב ליציבה. עובדים בטווח שאינו מכאיב.",
    contraindications: [],
  },
  {
    slug: "lat-pulldown",
    name_he: "משיכה בפולי עליון",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["machines"],
    primary: ["upper_back"], secondary: ["biceps", "forearms"],
    steps: ["יושבים במכונה ואוחזים במוט מעט רחב מהכתפיים.", "מושכים את המוט לגובה החזה העליון ומורידים את השכמות.", "משחררים לאט עד יישור הזרועות."],
    cautions: "לא מושכים מאחורי הראש.",
    contraindications: [],
  },
  {
    slug: "assisted-pull-up",
    name_he: "מתח בעזרת גומייה",
    category: "strength", mode: "reps", difficulty: "intermediate", equipment: ["pullup_bar", "bands"],
    primary: ["upper_back"], secondary: ["biceps", "forearms", "abs"],
    steps: ["תולים גומייה על מוט המתח ומניחים בה ברך או כף רגל.", "מושכים עד שהסנטר מעל המוט.", "יורדים בשליטה עד יישור הזרועות."],
    cautions: "גומייה עבה יותר נותנת יותר עזרה.",
    contraindications: ["shoulder"], easier: "band-row",
  },
  {
    slug: "pull-up",
    name_he: "מתח",
    category: "strength", mode: "reps", difficulty: "advanced", equipment: ["pullup_bar"],
    primary: ["upper_back"], secondary: ["biceps", "forearms", "abs"],
    steps: ["תולים במוט באחיזה מעט רחבה מהכתפיים.", "מושכים עד שהסנטר מעל המוט בלי נדנוד.", "יורדים בשליטה."],
    cautions: "אם עוד אין חזרה מלאה, מתחילים מגרסה עם גומייה.",
    contraindications: ["shoulder"], easier: "assisted-pull-up",
  },
  {
    slug: "db-biceps-curl",
    name_he: "כפיפת מרפקים",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["dumbbells"],
    primary: ["biceps"], secondary: ["forearms"],
    steps: ["עומדים עם משקולת בכל יד, כפות ידיים פונות קדימה.", "מכופפים את המרפקים ומרימים את המשקולות לכתפיים.", "מורידים לאט."],
    cautions: "המרפקים נשארים צמודים לגוף. בלי תנופה מהגב.",
    contraindications: [],
  },
  {
    slug: "band-biceps-curl",
    name_he: "כפיפת מרפקים עם גומייה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["bands"],
    primary: ["biceps"], secondary: ["forearms"],
    steps: ["עומדים על אמצע הגומייה ואוחזים בקצוות.", "מכופפים את המרפקים ומקרבים את הידיים לכתפיים.", "משחררים לאט."],
    cautions: "המרפקים נשארים צמודים לגוף.",
    contraindications: [],
  },
  {
    slug: "band-face-pull",
    name_he: "משיכה לפנים עם גומייה",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["bands"],
    primary: ["shoulders", "upper_back"], secondary: [],
    steps: ["קושרים גומייה בגובה העיניים.", "מושכים את הקצוות לכיוון הפנים ופותחים את המרפקים לצדדים.", "חוזרים לאט."],
    cautions: "מחזק את הכתף האחורית ותורם ליציבה.",
    contraindications: [],
  },
  {
    slug: "db-lateral-raise",
    name_he: "הרחקת כתפיים לצדדים",
    category: "strength", mode: "reps", difficulty: "beginner", equipment: ["dumbbells"],
    primary: ["shoulders"], secondary: [],
    steps: ["עומדים עם משקולות קלות לצד הגוף.", "מרימים את הזרועות לצדדים עד גובה הכתפיים, מרפקים מעט כפופים.", "מורידים לאט."],
    cautions: "משקל קל. לא מרימים מעל גובה הכתפיים.",
    contraindications: ["shoulder"],
  },

  // ── Core ───────────────────────────────────────────────────
  {
    slug: "plank",
    name_he: "פלאנק",
    category: "core", mode: "seconds", difficulty: "beginner", equipment: ["mat"],
    primary: ["abs"], secondary: ["shoulders", "glutes"],
    steps: ["נשענים על האמות והאצבעות, מרפקים מתחת לכתפיים.", "גוף ישר מהראש לעקבים, בטן מהודקת.", "מחזיקים את הזמן ונושמים."],
    cautions: "אם הגב התחתון שוקע, עוברים לגרסה על הברכיים.",
    contraindications: ["shoulder"], easier: "knee-plank",
  },
  {
    slug: "knee-plank",
    name_he: "פלאנק על הברכיים",
    category: "core", mode: "seconds", difficulty: "beginner", equipment: ["mat"],
    primary: ["abs"], secondary: ["shoulders"],
    steps: ["נשענים על האמות והברכיים.", "יוצרים קו ישר מהברכיים לראש.", "מחזיקים ונושמים."],
    cautions: "מכווצים קלות את הישבן כדי לשמור על הגב.",
    contraindications: [],
  },
  {
    slug: "side-plank-knee",
    name_he: "פלאנק צידי על הברך",
    category: "core", mode: "seconds", difficulty: "beginner", equipment: ["mat"],
    primary: ["obliques"], secondary: ["abs", "shoulders", "glutes"],
    steps: ["שוכבים על הצד, נשענים על האמה, ברכיים כפופות.", "מרימים את האגן עד קו ישר מהברכיים לכתף.", "מחזיקים ומחליפים צד."],
    cautions: "המרפק מתחת לכתף.",
    contraindications: ["shoulder"],
  },
  {
    slug: "dead-bug",
    name_he: "חיפושית מתה",
    category: "core", mode: "reps", difficulty: "beginner", equipment: ["mat"],
    primary: ["abs"], secondary: ["obliques"],
    steps: ["שוכבים על הגב, ידיים כלפי התקרה וברכיים מעל האגן.", "מורידים יד ורגל נגדית לכיוון הרצפה כשהגב התחתון צמוד.", "חוזרים ומחליפים צד."],
    cautions: "מאטים אם הגב התחתון מתרומם מהרצפה.",
    contraindications: ["supine"],
  },
  {
    slug: "bird-dog",
    name_he: "כלב-ציפור",
    category: "core", mode: "reps", difficulty: "beginner", equipment: ["mat"],
    primary: ["abs", "lower_back"], secondary: ["glutes", "shoulders"],
    steps: ["עומדים על ארבע, ידיים מתחת לכתפיים וברכיים מתחת לאגן.", "מושיטים יד אחת קדימה ורגל נגדית לאחור.", "מחזיקים שנייה, חוזרים ומחליפים צד."],
    cautions: "האגן לא מסתובב. התנועה איטית.",
    contraindications: ["wrist"],
  },
  {
    slug: "superman-hold",
    name_he: "סופרמן",
    category: "core", mode: "seconds", difficulty: "intermediate", equipment: ["mat"],
    primary: ["lower_back"], secondary: ["glutes", "upper_back"],
    steps: ["שוכבים על הבטן, ידיים קדימה.", "מרימים מעט את הידיים, החזה והרגליים מהרצפה.", "מחזיקים ויורדים לאט."],
    cautions: "הרמה קטנה מספיקה. המבט לרצפה כדי לא לעמוס על הצוואר.",
    contraindications: ["lower_back", "neck"], easier: "bird-dog",
  },

  // ── Cardio / conditioning ─────────────────────────────────
  {
    slug: "brisk-walk",
    name_he: "הליכה מהירה",
    category: "cardio", mode: "seconds", difficulty: "beginner", equipment: [],
    primary: ["calves", "quads"], secondary: ["glutes", "hamstrings"],
    steps: ["הולכים בקצב שבו אפשר לדבר אבל לא לשיר.", "מניעים ידיים באופן טבעי.", "מסיימים בכמה דקות של הליכה איטית."],
    cautions: "נעליים נוחות. בימים חמים שותים לפני ואחרי.",
    contraindications: [],
  },
  {
    slug: "march-in-place",
    name_he: "צעידה במקום",
    category: "cardio", mode: "seconds", difficulty: "beginner", equipment: [],
    primary: ["quads"], secondary: ["calves", "abs"],
    steps: ["צועדים במקום ומרימים ברכיים לגובה נוח.", "מניעים ידיים בקצב.", "מגבירים קצב בהדרגה."],
    cautions: "חלופה שקטה ללא קפיצות.",
    contraindications: [],
  },
  {
    slug: "step-jack",
    name_he: "פתיחות בצעד",
    category: "cardio", mode: "seconds", difficulty: "beginner", equipment: [],
    primary: ["shoulders", "calves"], secondary: ["quads", "glutes"],
    steps: ["צועדים רגל אחת לצד ומרימים ידיים מעל הראש.", "חוזרים למרכז ומחליפים צד.", "שומרים על קצב קבוע."],
    cautions: "גרסה ללא קפיצה של פתיחות.",
    contraindications: ["shoulder"],
  },
  {
    slug: "jumping-jacks",
    name_he: "פתיחות בקפיצה",
    category: "cardio", mode: "seconds", difficulty: "intermediate", equipment: [],
    primary: ["calves", "shoulders"], secondary: ["quads", "glutes"],
    steps: ["קופצים לפתיחת רגליים ומרימים ידיים מעל הראש.", "קופצים חזרה לסגירה.", "נוחתים רך על כריות כפות הרגליים."],
    cautions: "תרגיל עם קפיצות. מי שצריך מסלול מתון בוחר בפתיחות בצעד.",
    contraindications: ["knee", "high_impact"], easier: "step-jack",
  },
  {
    slug: "mountain-climber",
    name_he: "מטפס הרים",
    category: "cardio", mode: "seconds", difficulty: "intermediate", equipment: [],
    primary: ["abs"], secondary: ["shoulders", "quads"],
    steps: ["עומדים בתנוחת שכיבת סמיכה.", "מקרבים ברך אחת לחזה ומחליפים במהירות.", "האגן נשאר נמוך ויציב."],
    cautions: "אפשר לבצע לאט כצעידה, או עם ידיים על ספסל.",
    contraindications: ["wrist", "high_impact"],
  },

  // ── Mobility ───────────────────────────────────────────────
  {
    slug: "cat-cow",
    name_he: "חתול-פרה",
    category: "mobility", mode: "reps", difficulty: "beginner", equipment: ["mat"],
    primary: ["lower_back", "upper_back"], secondary: ["abs"],
    steps: ["עומדים על ארבע.", "בשאיפה מורידים את הבטן ומרימים את המבט.", "בנשיפה מעגלים את הגב ומורידים את הראש."],
    cautions: "תנועה איטית בטווח נוח.",
    contraindications: ["wrist"],
  },
  {
    slug: "hip-flexor-stretch",
    name_he: "מתיחת מכופפי ירך",
    category: "mobility", mode: "seconds", difficulty: "beginner", equipment: ["mat"],
    primary: ["quads"], secondary: ["glutes"],
    steps: ["כורעים על ברך אחת, הרגל השנייה קדימה.", "מכווצים את הישבן ודוחפים את האגן מעט קדימה.", "מחזיקים ומחליפים צד."],
    cautions: "מניחים מגבת מתחת לברך. מתיחה ולא כאב.",
    contraindications: ["knee"],
  },
  {
    slug: "hamstring-stretch",
    name_he: "מתיחת אחורי ירך",
    category: "mobility", mode: "seconds", difficulty: "beginner", equipment: [],
    primary: ["hamstrings"], secondary: ["calves"],
    steps: ["מניחים עקב על מדרגה נמוכה, ברך ישרה.", "נוטים קדימה מהאגן עם גב ישר.", "מחזיקים ומחליפים צד."],
    cautions: "לא מעגלים את הגב כדי להגיע רחוק יותר.",
    contraindications: [],
  },
  {
    slug: "doorway-chest-stretch",
    name_he: "מתיחת חזה במשקוף",
    category: "mobility", mode: "seconds", difficulty: "beginner", equipment: [],
    primary: ["chest"], secondary: ["shoulders"],
    steps: ["מניחים אמה על משקוף, מרפק בגובה הכתף.", "צועדים צעד קטן קדימה עד מתיחה בחזה.", "מחזיקים ומחליפים צד."],
    cautions: "מתיחה עדינה. עוצרים אם יש עקצוץ ביד.",
    contraindications: ["shoulder"],
  },
  {
    slug: "thoracic-rotation",
    name_he: "סיבוב גב עליון",
    category: "mobility", mode: "reps", difficulty: "beginner", equipment: ["mat"],
    primary: ["upper_back"], secondary: ["obliques", "chest"],
    steps: ["שוכבים על הצד, ברכיים כפופות, ידיים צמודות קדימה.", "פותחים את היד העליונה לצד השני ועוקבים אחריה במבט.", "חוזרים לאט. משלימים חזרות ומחליפים צד."],
    cautions: "הברכיים נשארות צמודות לרצפה.",
    contraindications: [],
  },
];
