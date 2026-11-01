/**
 * Knowledge cards: the small "?" next to a task, a target or a metric. Each card answers
 * "why does this matter" in a few sentences, says what is still uncertain, and names the
 * sources it is based on, with the kind of evidence each one is.
 *
 * Rules for this file:
 * - Original wording. A number in a card must come from one of the card's own sources.
 * - Every PubMed link was checked against the PubMed API (title, journal, year).
 * - Prefer guidelines, systematic reviews and meta-analyses over single studies.
 *
 * The personal line ("מה זה אומר לך") is built in src/lib/knowledge/personal.ts from the
 * user's own data, and is left out when there is nothing real to say.
 */

export type EvidenceKind = "guideline" | "meta" | "review" | "guide";

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  guideline: "הנחיה מקצועית",
  meta: "מטה-אנליזה",
  review: "סקירה",
  guide: "מדריך בריאות",
};

/** Strongest first: used to show one evidence badge per card. */
const EVIDENCE_ORDER: EvidenceKind[] = ["meta", "guideline", "review", "guide"];

export interface Source {
  title: string;
  publisher: string;
  url: string;
  kind: EvidenceKind;
}

export interface KnowledgeCard {
  title: string;
  /** Why it matters: the mechanism and the practical meaning, 2–3 short sentences. */
  body: string;
  /** What is still uncertain or depends on the person. One sentence. */
  uncertain: string;
  /** Said when there is no personal line. */
  general: string;
  sources: Source[];
}

const S = {
  whoActivity: {
    title: "WHO guidelines on physical activity and sedentary behaviour (2020)",
    publisher: "ארגון הבריאות העולמי",
    url: "https://www.who.int/publications/i/item/9789240015128",
    kind: "guideline",
  },
  nhsWater: {
    title: "Water, drinks and hydration",
    publisher: "NHS",
    url: "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/",
    kind: "guide",
  },
  acsmFluids: {
    title: "ACSM position stand: Exercise and fluid replacement (2007)",
    publisher: "Med Sci Sports Exerc",
    url: "https://pubmed.ncbi.nlm.nih.gov/17277604/",
    kind: "guideline",
  },
  acsmProgression: {
    title: "ACSM position stand: Progression models in resistance training for healthy adults (2009)",
    publisher: "Med Sci Sports Exerc",
    url: "https://pubmed.ncbi.nlm.nih.gov/19204579/",
    kind: "guideline",
  },
  volume: {
    title: "Schoenfeld et al. 2017: Weekly resistance training volume and muscle mass",
    publisher: "J Sports Sci",
    url: "https://pubmed.ncbi.nlm.nih.gov/27433992/",
    kind: "meta",
  },
  load: {
    title: "Schoenfeld et al. 2017: Low- vs high-load resistance training",
    publisher: "J Strength Cond Res",
    url: "https://pubmed.ncbi.nlm.nih.gov/28834797/",
    kind: "meta",
  },
  frequency: {
    title: "Schoenfeld et al. 2016: Resistance training frequency and muscle hypertrophy",
    publisher: "Sports Med",
    url: "https://pubmed.ncbi.nlm.nih.gov/27102172/",
    kind: "meta",
  },
  proteinMeta: {
    title: "Morton et al. 2018: Protein supplementation and resistance training gains",
    publisher: "Br J Sports Med",
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
    kind: "meta",
  },
  proteinMeal: {
    title: "Schoenfeld & Aragon 2018: How much protein can the body use in a single meal?",
    publisher: "J Int Soc Sports Nutr",
    url: "https://pubmed.ncbi.nlm.nih.gov/29497353/",
    kind: "review",
  },
  issnProtein: {
    title: "ISSN position stand: protein and exercise (2017)",
    publisher: "J Int Soc Sports Nutr",
    url: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
    kind: "guideline",
  },
  steps: {
    title: "Paluch et al. 2022: Daily steps and all-cause mortality, 15 cohorts",
    publisher: "Lancet Public Health",
    url: "https://pubmed.ncbi.nlm.nih.gov/35247352/",
    kind: "meta",
  },
  sleepAmount: {
    title: "AASM & SRS consensus: Recommended amount of sleep for a healthy adult (2015)",
    publisher: "Sleep",
    url: "https://pubmed.ncbi.nlm.nih.gov/26039963/",
    kind: "guideline",
  },
  sleepSport: {
    title: "Fullagar et al. 2015: Sleep and athletic performance",
    publisher: "Sports Med",
    url: "https://pubmed.ncbi.nlm.nih.gov/25315456/",
    kind: "review",
  },
  fibre: {
    title: "Reynolds et al. 2019: Carbohydrate quality and human health",
    publisher: "Lancet",
    url: "https://pubmed.ncbi.nlm.nih.gov/30638909/",
    kind: "meta",
  },
  harvardPlate: {
    title: "Healthy Eating Plate",
    publisher: "Harvard T.H. Chan School of Public Health",
    url: "https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/",
    kind: "guide",
  },
  mifflin: {
    title: "Mifflin et al. 1990: A predictive equation for resting energy expenditure",
    publisher: "Am J Clin Nutr",
    url: "https://pubmed.ncbi.nlm.nih.gov/2305711/",
    kind: "review",
  },
  frankenfield: {
    title: "Frankenfield et al. 2005: Comparison of equations for resting metabolic rate",
    publisher: "J Am Diet Assoc",
    url: "https://pubmed.ncbi.nlm.nih.gov/15883556/",
    kind: "review",
  },
  helms: {
    title: "Helms et al. 2014: Evidence-based recommendations for contest preparation: nutrition",
    publisher: "J Int Soc Sports Nutr",
    url: "https://pubmed.ncbi.nlm.nih.gov/24864135/",
    kind: "review",
  },
  iraki: {
    title: "Iraki et al. 2019: Nutrition recommendations for bodybuilders in the off-season",
    publisher: "Sports",
    url: "https://pubmed.ncbi.nlm.nih.gov/31247944/",
    kind: "review",
  },
} satisfies Record<string, Source>;

export const KNOWLEDGE = {
  water: {
    title: "שתייה",
    body: "הזעה היא הדרך העיקרית של הגוף להתקרר, והיא מוציאה נוזלים. איבוד של יותר מ-2% ממשקל הגוף בנוזלים פוגע בביצועים במאמץ אירובי, בעיקר בחום. קצב ההזעה שונה מאוד בין אנשים, מ-0.3 ועד 2.4 ליטר בשעת מאמץ, ולכן אין מספר אחד שמתאים לכולם.",
    uncertain: "בשגרה ובמזג אוויר נוח, הצמא מכוון היטב את רוב האנשים. היעד כאן הוא נקודת התחלה ולא כלל.",
    general: "ביום חם או ביום אימון כדאי להוסיף. שתן בהיר הוא סימן פשוט לכך שהשתייה מספיקה.",
    sources: [S.acsmFluids, S.nhsWater],
  },
  strength: {
    title: "אימון כוח",
    body: "השריר גדל בתגובה לעומס, ולכן הנפח השבועי חשוב: 10 סטים ומעלה לשריר בשבוע נתנו יותר גדילה מפחות מ-5. משקל קל עם הרבה חזרות בונה שריר כמעט כמו משקל כבד, אם מגיעים קרוב לכשל, אבל משקל כבד עדיף לכוח. אימון של כל שריר פעמיים בשבוע עדיף על פעם אחת.",
    uncertain: "התגובה לאימון שונה מאדם לאדם, ומתחילים מתקדמים מהר גם בנפח נמוך יותר.",
    general: "הכי חשוב זה קביעות ועלייה הדרגתית בעומס. גם אימון קצר נחשב.",
    sources: [S.volume, S.load, S.frequency, S.acsmProgression],
  },
  rest: {
    title: "יום מנוחה",
    body: "הגוף לא מתחזק בזמן האימון אלא בהתאוששות שאחריו. לכן התוכנית משאירה יום בין אימוני גוף מלא. ב-2–3 אימונים כאלה בשבוע כל שריר עובד לפחות פעמיים, תדירות שנמצאה יעילה יותר מפעם אחת.",
    uncertain: "כמה מנוחה צריך תלוי בעצימות, בשינה ובניסיון. אין מספר ימים אחד שנכון לכולם.",
    general: "יום מנוחה הוא חלק מהתוכנית. הליכה קלה בו עדיין מועילה.",
    sources: [S.frequency, S.acsmProgression],
  },
  protein: {
    title: "חלבון",
    body: "חלבון מספק את אבני הבניין לתיקון ולבניית שריר. מטה-אנליזה של 49 מחקרים מצאה שהתועלת לשריר מפסיקה לעלות בערך ב-1.6 גרם לק״ג ביום. חלוקה ל-3–4 ארוחות עם חלבון עדיפה על מנה אחת גדולה.",
    uncertain: "מעל 2.2 גרם לק״ג לא הוכחה תועלת נוספת לשריר. מבוגרים עשויים להזדקק למעט יותר בכל ארוחה.",
    general: "לא צריך לספור גרמים. מספיק לוודא שיש מקור חלבון ברוב הארוחות.",
    sources: [S.proteinMeta, S.proteinMeal, S.issnProtein],
  },
  walking: {
    title: "הליכה",
    body: "במחקר שאיחד 15 קבוצות אוכלוסייה, יותר צעדים ביום היו קשורים לתמותה נמוכה יותר, עד שהתועלת התייצבה: בערך 6,000–8,000 צעדים מגיל 60, ו-8,000–10,000 מתחת לגיל 60. כלומר, גם תוספת קטנה מועילה למי שמתחיל נמוך.",
    uncertain: "אלה מחקרי תצפית: הם מראים קשר, לא בהכרח סיבה. קצב ההליכה פחות ברור מכמות הצעדים.",
    general: "כמה הליכות קצרות במהלך היום נחשבות בדיוק כמו הליכה אחת ארוכה.",
    sources: [S.steps, S.whoActivity],
  },
  sleep: {
    title: "שינה",
    body: "איגודי רפואת השינה ממליצים למבוגרים על 7 שעות ומעלה בקביעות. חוסר שינה פוגע בעיקר בביצועים במאמץ ממושך ובריכוז, ומשפיע גם על התיאבון ועל ההתאוששות.",
    uncertain: "ההשפעה על כוח מרבי פחות עקבית במחקרים מאשר ההשפעה על סיבולת וקשב.",
    general: "שעת שינה וקימה קבועות עוזרות יותר מכל טריק אחר. אחרי לילה קצר, עדיף אימון קל.",
    sources: [S.sleepAmount, S.sleepSport],
  },
  plate: {
    title: "הרכב הצלחת",
    body: "ירקות, חלבון ופחמימה מלאה בכל ארוחה נותנים שובע ואנרגיה יציבה. בסדרת מטה-אנליזות ב-Lancet, מי שאכלו הכי הרבה סיבים היו בסיכון נמוך ב-15–30% לתמותה, למחלות לב, לסוכרת ולסרטן המעי. 25–29 גרם ביום נמצאו כמות מספקת לתועלת.",
    uncertain: "רוב הנתונים על סיבים הם מחקרי תצפית. התועלת גדלה כנראה גם מעל 29 גרם, אבל פחות ברור עד כמה.",
    general: "המסגרת נותנת כיוון ולא מתכון. אין צורך לשקול או לספור.",
    sources: [S.fibre, S.harvardPlate],
  },
  calories: {
    title: "יעד קלורי",
    body: "הצריכה היומית מחושבת בנוסחת Mifflin-St Jeor, שנמצאה המדויקת מבין הנוסחאות הנפוצות בסקירה שיטתית, כפול רמת הפעילות. לירידה במשקל מורידים כמות שמתאימה לירידה של כחצי אחוז ממשקל הגוף בשבוע, קצב שעוזר לשמור על השריר. לבניית שריר מוסיפים כ-10%, כי תוספת גדולה יותר מוסיפה בעיקר שומן.",
    uncertain: "הנוסחה יכולה לטעות בכ-10% לכל כיוון, ולכן אחרי שבועיים-שלושה מגמת המשקל בפועל אומרת יותר.",
    general: "המספר הוא נקודת התחלה ולא כלל. רעב מתמשך או עייפות הם סימן לבדוק אותו.",
    sources: [S.mifflin, S.frankenfield, S.helms, S.iraki],
  },
} satisfies Record<string, KnowledgeCard>;

export type KnowledgeTopic = keyof typeof KNOWLEDGE;

/** The strongest kind of evidence among a card's sources, for its badge. */
export function strongestEvidence(card: KnowledgeCard): EvidenceKind {
  return EVIDENCE_ORDER.find((k) => card.sources.some((s) => s.kind === k)) ?? "guide";
}
