/**
 * Knowledge cards (follow-up spec §2): a short explanation next to a task, a target or a
 * metric. Original wording; every card names the public sources it is based on, and each
 * source link was checked to open. No card claims a source it does not cite.
 *
 * The personal line ("למה זה חשוב לך") is built in src/lib/knowledge/personal.ts from the
 * user's own data, and is left out when there is nothing real to say.
 */

export interface Source {
  title: string;
  publisher: string;
  url: string;
}

export interface KnowledgeCard {
  title: string;
  /** 2–4 short sentences. */
  body: string;
  /** Said when there is no personal line. */
  general: string;
  sources: Source[];
}

const S = {
  whoActivity: {
    title: "WHO guidelines on physical activity and sedentary behaviour",
    publisher: "ארגון הבריאות העולמי (WHO)",
    url: "https://www.who.int/publications/i/item/9789240015128",
  },
  whoFact: {
    title: "Physical activity: fact sheet",
    publisher: "ארגון הבריאות העולמי (WHO)",
    url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
  },
  whoDiet: {
    title: "Healthy diet: fact sheet",
    publisher: "ארגון הבריאות העולמי (WHO)",
    url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
  },
  nhsWater: {
    title: "Water, drinks and hydration",
    publisher: "NHS (שירות הבריאות הבריטי)",
    url: "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/",
  },
  nhsGuidelines: {
    title: "Physical activity guidelines for adults aged 19 to 64",
    publisher: "NHS (שירות הבריאות הבריטי)",
    url: "https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/",
  },
  nhsStrength: {
    title: "Strength exercises",
    publisher: "NHS (שירות הבריאות הבריטי)",
    url: "https://www.nhs.uk/live-well/exercise/strength-exercises/",
  },
  nhsWalking: {
    title: "Walking for health",
    publisher: "NHS (שירות הבריאות הבריטי)",
    url: "https://www.nhs.uk/live-well/exercise/walking-for-health/",
  },
  nhsEating: {
    title: "8 tips for healthy eating",
    publisher: "NHS (שירות הבריאות הבריטי)",
    url: "https://www.nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/eight-tips-for-healthy-eating/",
  },
  nhsSleep: {
    title: "How to get to sleep",
    publisher: "NHS (שירות הבריאות הבריטי)",
    url: "https://www.nhs.uk/live-well/sleep-and-tiredness/how-to-get-to-sleep/",
  },
  harvardPlate: {
    title: "Healthy Eating Plate",
    publisher: "בית הספר לבריאות הציבור של הרווארד",
    url: "https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/",
  },
  harvardProtein: {
    title: "Protein",
    publisher: "בית הספר לבריאות הציבור של הרווארד",
    url: "https://nutritionsource.hsph.harvard.edu/what-should-you-eat/protein/",
  },
  harvardWater: {
    title: "Water",
    publisher: "בית הספר לבריאות הציבור של הרווארד",
    url: "https://nutritionsource.hsph.harvard.edu/water/",
  },
  acsm: {
    title: "ACSM position stand: Progression models in resistance training for healthy adults (2009)",
    publisher: "American College of Sports Medicine (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/19204579/",
  },
  issnProtein: {
    title: "ISSN position stand: protein and exercise (2017)",
    publisher: "International Society of Sports Nutrition (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
  },
  mifflin: {
    title: "Mifflin et al. 1990: A new predictive equation for resting energy expenditure in healthy individuals",
    publisher: "Am J Clin Nutr (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/2305711/",
  },
  frankenfield: {
    title: "Frankenfield et al. 2005: Comparison of predictive equations for resting metabolic rate (systematic review)",
    publisher: "J Am Diet Assoc (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/15883556/",
  },
  helms: {
    title: "Helms et al. 2014: Evidence-based recommendations for natural bodybuilding contest preparation",
    publisher: "J Int Soc Sports Nutr (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/24864135/",
  },
  iraki: {
    title: "Iraki et al. 2019: Nutrition recommendations for bodybuilders in the off-season",
    publisher: "Sports (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/31247944/",
  },
} satisfies Record<string, Source>;

export const KNOWLEDGE = {
  water: {
    title: "שתייה",
    body: "שתייה מספקת תומכת בתפקוד הגוף ובוויסות החום. הצורך משתנה לפי פעילות, מזג אוויר, תזונה ומצב בריאותי, ולכן היעד הוא אומדן אישי ולא כלל אחיד. נוח יותר לפזר את השתייה לאורך היום מאשר להשלים הכול בבת אחת.",
    general: "יעד המים בתוכנית הוא נקודת התחלה. ביום חם או ביום אימון כדאי לשתות קצת יותר.",
    sources: [S.nhsWater, S.harvardWater],
  },
  strength: {
    title: "אימון כוח",
    body: "אימוני כוח מסייעים לפתח כוח ולשמר או להגדיל מסת שריר. ההתקדמות תלויה בעומס שעולה בהדרגה, בטכניקה טובה ובהתאוששות בין האימונים. ההמלצה הכללית למבוגרים היא לפחות יומיים בשבוע של חיזוק כל קבוצות השרירים הגדולות.",
    general: "גם אימון קצר נחשב. מה שחשוב הוא קביעות ועלייה הדרגתית.",
    sources: [S.whoActivity, S.nhsStrength, S.acsm],
  },
  rest: {
    title: "מנוחה",
    body: "ההתאוששות היא חלק מתהליך האימון. יום מנוחה מאפשר לגוף להסתגל לעומס, ולכן התוכנית משאירה ימים בלי אימון בין ימי האימון. ביום כזה תנועה קלה כמו הליכה עדיין מועילה.",
    general: "יום מנוחה הוא לא יום \"מבוזבז\". הוא חלק מהתוכנית.",
    sources: [S.acsm, S.nhsGuidelines],
  },
  protein: {
    title: "חלבון",
    body: "חלבון מספק אבני בניין לרקמות, כולל שרירים. הכמות המתאימה תלויה במטרה, בפעילות ובמצב הבריאותי. נוח לשלב מקור חלבון בכל ארוחה עיקרית, ממקורות מגוונים כמו קטניות, ביצים, דגים, עוף או מוצרי חלב.",
    general: "לא צריך לספור גרמים. מספיק לוודא שיש מקור חלבון ברוב הארוחות.",
    sources: [S.harvardProtein, S.issnProtein],
  },
  walking: {
    title: "הליכה",
    body: "הליכה יכולה להגדיל את הפעילות היומית בלי לדרוש אימון מורכב. אפשר להתחיל בפרקי זמן קצרים ולהתקדם בהדרגה. הליכה בקצב שבו אפשר לדבר אבל לא לשיר נחשבת לפעילות בעצימות בינונית.",
    general: "כמה הליכות קצרות במהלך היום נחשבות בדיוק כמו הליכה אחת ארוכה.",
    sources: [S.nhsWalking, S.whoFact],
  },
  sleep: {
    title: "שינה",
    body: "שינה סדירה היא חלק מההתאוששות ומשפיעה על האנרגיה, על התיאבון ועל מצב הרוח. רוב המבוגרים צריכים 7–9 שעות. שעת שינה ושעת קימה קבועות עוזרות יותר מכל טריק אחר.",
    general: "אם הלילה היה קצר, עדיף אימון קל יותר מאשר לוותר על השינה.",
    sources: [S.nhsSleep],
  },
  plate: {
    title: "הרכב הצלחת",
    body: "ארוחה מאוזנת משלבת בדרך כלל ירקות, מקור חלבון, פחמימה מלאה ומעט שומן איכותי. זו מסגרת גמישה ולא מתכון: אפשר להרכיב אותה ממה שיש בבית. ירקות וסיבים עוזרים לשובע.",
    general: "המסגרת נותנת כיוון. אין צורך לשקול או לספור.",
    sources: [S.harvardPlate, S.whoDiet, S.nhsEating],
  },
  calories: {
    title: "יעד קלורי",
    body: "הצריכה היומית מחושבת בנוסחת Mifflin-St Jeor, שנמצאה המדויקת מבין הנוסחאות הנפוצות בסקירה שיטתית, כפול רמת הפעילות. לירידה במשקל מורידים כמות שמתאימה לירידה של כחצי אחוז ממשקל הגוף בשבוע: קצב איטי יותר עוזר לשמור על השריר. לבניית שריר מוסיפים כ-10%, כי תוספת גדולה יותר מוסיפה בעיקר שומן.",
    general: "המספר הוא נקודת התחלה. הנוסחה יכולה לטעות בכ-10% לכל כיוון, ולכן אחרי שבועיים-שלושה מגמת המשקל בפועל אומרת יותר.",
    sources: [S.mifflin, S.frankenfield, S.helms, S.iraki],
  },
} satisfies Record<string, KnowledgeCard>;

export type KnowledgeTopic = keyof typeof KNOWLEDGE;
