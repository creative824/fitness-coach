# AI Fitness Coach

פלטפורמת PWA בעברית למאמן אישי בכושר, תזונה והרגלים. המשתמש ממלא שאלון, מקבל תוכנית שבועית, ובכל יום מסמן משימות, צובר נקודות ורואה התקדמות.

**סטטוס:** שלב 0 (שלד). פרטים ב-[docs/TECH_PLAN.md](docs/TECH_PLAN.md).

## הרצה מקומית

דרוש Node.js 20.9 ומעלה.

```bash
npm install
cp .env.example .env.local   # בשלב 0 אין צורך למלא ערכים
npm run dev                  # http://localhost:3000
```

## בדיקות

```bash
npm run lint
npm run typecheck
npm test          # לוגיקה: billing, סכמת התוכנית
npm run test:db   # מיגרציה + כללי RLS על Postgres בזיכרון
npm run build
```

## מבנה

- `src/app` מסכים: ציבורי, שאלון, אזור אישי, אדמין
- `src/components` רכיבי UI וניווט
- `src/lib` טקסטים (i18n), דגלים, billing כבוי, סכמת התוכנית
- `supabase/migrations` סכמת הנתונים עם RLS
- `docs` תוכנית טכנית ו-[billing](docs/BILLING.md)

## עקרונות

- מפתחות API בשרת בלבד. אין מידע רגיש בלוגים.
- ה-AI בוחר ומרכיב מתוך מאגרים מאושרים, ולא ממציא תרגילים, כמויות או ערכים תזונתיים.
- המוצר אינו מאבחן, מטפל או מחליף רופא, דיאטן או פיזיותרפיסט.
- תשלום: תשתית בלבד, כבויה (`BILLING_ENABLED=false`).
