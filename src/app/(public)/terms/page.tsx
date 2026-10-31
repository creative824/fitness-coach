import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
export const metadata: Metadata = { title: t.legal.termsTitle };

export default function TermsPage() {
  return (
    <LegalPage title={t.legal.termsTitle}>
      <h2>מהות השירות</h2>
      <p>
        השירות מספק הכוונה כללית לאורח חיים פעיל ותזונה מאוזנת. הוא אינו שירות רפואי, אינו מאבחן ואינו מטפל, ואינו מחליף רופא/ה, דיאטן/ית או
        פיזיותרפיסט/ית.
      </p>
      <h2>אחריות המשתמש</h2>
      <ul>
        <li>להזין מידע נכון, ולעדכן כשמשהו משתנה.</li>
        <li>להפסיק פעילות שגורמת לכאב, סחרחורת או קוצר נשימה חריג, ולפנות לגורם רפואי.</li>
        <li>להתייעץ עם איש מקצוע לפני תחילת תוכנית אם יש מצב רפואי, היריון או פציעה.</li>
      </ul>
      <h2>תוכן שנוצר על ידי AI</h2>
      <p>חלק מההמלצות נוצרות בעזרת בינה מלאכותית ועשויות לכלול טעויות. ההמלצות נבדקות מול כללי בטיחות, אך אין להן תוקף של ייעוץ מקצועי.</p>
      <h2>גיל</h2>
      <p>השימוש מותר מגיל 18.</p>
      <h2>תשלום</h2>
      <p>בתקופת הבטא השירות ניתן ללא תשלום.</p>
    </LegalPage>
  );
}
