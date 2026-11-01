/**
 * The "למה זה חשוב לך" line of a knowledge card (follow-up spec §2–§3). Built only from data the
 * user gave or the plan holds; returns null when there is nothing real to say, and the card then
 * shows its general line instead.
 */
import type { KnowledgeTopic } from "@/content/knowledge";
import type { OnboardingDraft } from "@/lib/onboarding/schema";
import type { WeeklyPlan } from "@/lib/plan/schema";

export interface PersonalContext {
  draft: OnboardingDraft | null;
  plan: WeeklyPlan | null;
}

const has = (d: OnboardingDraft | null, g: string) => Boolean(d?.goals.includes(g as never));

export function personalNote(topic: KnowledgeTopic, { draft: d, plan }: PersonalContext): string | null {
  const workouts = plan?.days.filter((x) => x.workout).length ?? 0;
  switch (topic) {
    case "water": {
      const ml = plan?.targets.water_ml;
      if (!ml) return null;
      return d?.weight_kg
        ? `היעד שלך, ${(ml / 1000).toFixed(1)} ליטר, חושב לפי המשקל שמילאת (${d.weight_kg} ק"ג), וביום אימון הוא עולה מעט.`
        : `היעד שלך הוא ${(ml / 1000).toFixed(1)} ליטר ביום, וביום אימון הוא עולה מעט.`;
    }
    case "strength":
      if (has(d, "muscle") || has(d, "strength")) return `המטרה שבחרת היא ${has(d, "muscle") ? "לבנות שריר" : "להתחזק"}, ולכן כל אימון בתוכנית שלך כולל תרגילי כוח לכל הגוף.`;
      if (has(d, "lose_weight")) return "בירידה במשקל, אימוני כוח עוזרים לשמור על מסת השריר. לכן הם חלק מהתוכנית שלך.";
      return workouts ? `בתוכנית שלך ${workouts} אימונים השבוע, וכל אחד כולל תרגילי כוח לכל הגוף.` : null;
    case "rest":
      return workouts ? `בתוכנית שלך ${workouts} אימונים השבוע, עם ימי מנוחה ביניהם כשאפשר.` : null;
    case "protein":
      if (has(d, "muscle") || has(d, "gain_weight")) return "למטרה של בניית שריר, מקור חלבון בכל ארוחה עיקרית תומך בהתאוששות מהאימונים.";
      if (has(d, "lose_weight")) return "בירידה במשקל, חלבון בכל ארוחה עוזר לשובע ולשמירה על השריר.";
      if (d?.dietary_pattern === "vegan" || d?.dietary_pattern === "vegetarian") return "בתזונה צמחית כדאי לגוון מקורות: קטניות, טופו, אגוזים ודגנים מלאים.";
      return null;
    case "walking":
      if (has(d, "endurance")) return "למטרה של שיפור סיבולת, בימים בלי אימון יש לך משימת הליכה.";
      return plan?.days.some((x) => x.is_rest_day) ? "בימים בלי אימון התוכנית שלך כוללת הליכה או תנועה קלה." : null;
    case "sleep":
      if (d?.sleep_hours && d.sleep_hours < 7) return `ציינת שבדרך כלל ישנים כ-${d.sleep_hours} שעות. גם חצי שעה נוספת יכולה לעזור להתאוששות.`;
      return d?.sleep_hours ? `ציינת כ-${d.sleep_hours} שעות שינה בלילה. היעד בתוכנית הוא 7–9.` : null;
    case "plate":
      if (d?.allergies.length || (d?.dietary_pattern && d.dietary_pattern !== "omnivore")) return "הדוגמאות לכל ארוחה כבר מסוננות לפי סוג התזונה והאלרגיות שציינת.";
      return d?.meals_per_day ? `המסגרת בנויה ל-${d.meals_per_day} ארוחות ביום, כמו שציינת.` : null;
    case "calories": {
      const r = plan?.targets.calories_range;
      if (!r) return null;
      const k = plan?.targets.calories_kcal;
      if (k) {
        return `היעד שלך, כ-${k.toLocaleString("en-US")} קלוריות ביום, מחושב לפי הגיל, הגובה, המשקל והפעילות שמילאת${has(d, "lose_weight") ? ", עם גירעון מתון" : has(d, "muscle") || has(d, "gain_weight") ? ", עם תוספת קטנה" : ""}. הארוחות בתוכנית מתחלקות כך שיחד הן מגיעות אליו.`;
      }
      return `הטווח שלך, ${r[0]}–${r[1]} קלוריות ביום, הוא הערכה לפי הגיל, הגובה, המשקל והפעילות שמילאת${has(d, "lose_weight") ? ", עם גירעון מתון" : has(d, "muscle") || has(d, "gain_weight") ? ", עם תוספת מתונה" : ""}.`;
    }
  }
}
