/**
 * Muscle groups used by the exercise library and the 2D body map (spec §11).
 * The first eleven are the clickable regions named in the spec; the rest appear only as
 * supporting muscles. Descriptions are general and educational, not diagnostic.
 */
export const MUSCLES = [
  { id: "chest", name_he: "חזה", view: "front", description_he: "דוחף את הזרועות קדימה ופנימה, למשל בשכיבות סמיכה." },
  { id: "upper_back", name_he: "גב עליון", view: "back", description_he: "מושך את הזרועות לאחור ולמטה ומייצב את השכמות. חשוב ליציבה." },
  { id: "lower_back", name_he: "גב תחתון", view: "back", description_he: "זוקפי הגב מחזיקים את עמוד השדרה זקוף בהרמה ובכפיפה." },
  { id: "shoulders", name_he: "כתפיים", view: "both", description_he: "מרימים את הזרועות לכל הכיוונים: קדימה, לצדדים ולאחור." },
  { id: "biceps", name_he: "דו-ראשי", view: "front", description_he: "מכופף את המרפק, למשל בהרמת שקית." },
  { id: "triceps", name_he: "תלת-ראשי", view: "back", description_he: "מיישר את המרפק, למשל בדחיפה." },
  { id: "abs", name_he: "בטן וליבה", view: "front", description_he: "מייצבים את הגו ומעבירים כוח בין פלג הגוף העליון לתחתון." },
  { id: "glutes", name_he: "ישבן", view: "back", description_he: "מיישרים את הירך, למשל בקימה מכיסא או בעלייה במדרגות." },
  { id: "quads", name_he: "ארבע-ראשי", view: "front", description_he: "מיישר את הברך. עובד בכל עלייה וירידה." },
  { id: "hamstrings", name_he: "המסטרינג", view: "back", description_he: "מכופף את הברך ועוזר ליישר את הירך." },
  { id: "calves", name_he: "תאומים", view: "back", description_he: "מרימים את העקב. עובדים בכל צעד והליכה." },
  { id: "forearms", name_he: "אמות", view: "both", description_he: "אחיזה ויציבות של שורש כף היד." },
  { id: "obliques", name_he: "אלכסוני בטן", view: "front", description_he: "מסובבים ומייצבים את הגו לצדדים." },
  { id: "adductors", name_he: "מקרבי ירך", view: "front", description_he: "מקרבים את הרגליים זו לזו ומייצבים את האגן." },
] as const;

export type MuscleId = (typeof MUSCLES)[number]["id"];

/** Regions drawn and clickable on the body map. */
export const CLICKABLE_MUSCLES: readonly MuscleId[] = [
  "chest",
  "upper_back",
  "lower_back",
  "shoulders",
  "biceps",
  "triceps",
  "abs",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
];
