/**
 * "Why this plan fits you" (follow-up spec §3). Each line pairs something the user actually told
 * us with a decision the plan engine actually made because of it. Nothing is said about data
 * the user did not give, and nothing claims a decision the engine does not make.
 *
 * Built from the current profile and the saved plan on every render, so the lines follow any
 * change to either.
 */
import { blockedTags } from "./candidates";
import type { OnboardingDraft } from "@/lib/onboarding/schema";
import type { SafetyResult } from "@/lib/safety/screen";
import type { WeeklyPlan } from "./schema";

export interface WhyLine {
  /** What the user told us. */
  because: string;
  /** What the plan does about it. */
  decision: string;
}

const GOAL: Record<string, { label: string; decision: (p: WeeklyPlan, d: OnboardingDraft) => string | null }> = {
  lose_weight: {
    label: "לרדת במשקל",
    decision: (p) =>
      p.targets.calories_range
        ? "יעד הקלוריות נמוך מעט מהצריכה המשוערת שלך, בקצב של כחצי אחוז ממשקל הגוף בשבוע, בלי דיאטה קיצונית. לצדו אימוני כוח ששומרים על השריר."
        : "התוכנית מתמקדת בתנועה, ארוחות משביעות והרגלים, בלי יעד קלורי.",
  },
  maintain_weight: { label: "לשמור על המשקל", decision: () => "טווח הקלוריות סביב הצריכה המשוערת שלך, עם אימונים והרגלים קבועים." },
  gain_weight: {
    label: "לעלות במשקל",
    decision: (p) =>
      p.targets.calories_range ? "יעד הקלוריות כולל תוספת קטנה של כ-10% מעל הצריכה המשוערת, ואימוני כוח לכל הגוף." : "שילבנו אימוני כוח לכל הגוף.",
  },
  muscle: {
    label: "לבנות שריר",
    decision: (p) =>
      `שילבנו אימוני כוח לכל הגוף${p.targets.calories_range ? ", טווח קלוריות עם תוספת מתונה" : ""} וימי מנוחה בין האימונים להתאוששות.`,
  },
  strength: { label: "להתחזק", decision: () => "כל אימון כולל תרגילי כוח לרגליים, לדחיפה ולליבה, עם ימי מנוחה ביניהם." },
  endurance: { label: "לשפר סיבולת", decision: () => "בימים בלי אימון יש משימת הליכה או תנועה קלה." },
  general_fitness: { label: "כושר כללי", decision: () => "המעקב משלב אימונים, תנועה יומית, שתייה ושינה, ולא רק משקל." },
  flexibility: {
    label: "גמישות",
    decision: (_p, d) => ((d.session_minutes ?? 0) > 50 ? "בכל אימון יש גם תרגיל תנועתיות." : null),
  },
  habits: { label: "לבנות הרגלים", decision: () => "כל יום יש כמה משימות קטנות וברורות: שתייה, תנועה ושינה." },
};

const AREA: Record<string, string> = { knee: "הברכיים", shoulder: "הכתפיים", lower_back: "הגב", wrist: "שורש כף היד", neck: "הצוואר" };

const ALLERGEN_HE: Record<string, string> = {
  gluten: "גלוטן",
  milk: "חלב",
  egg: "ביצים",
  peanut: "בוטנים",
  tree_nut: "אגוזים",
  soy: "סויה",
  fish: "דגים",
  shellfish: "פירות ים",
  sesame: "שומשום",
};
const DIET_HE: Record<string, string> = { vegetarian: "צמחונית", vegan: "טבעונית", pescatarian: "צמחונית עם דגים", kosher: "כשרה" };

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ו${xs[xs.length - 1]}`);

/** Up to `max` lines, most relevant first. */
export function whyThisPlan(d: OnboardingDraft, plan: WeeklyPlan, safety: SafetyResult, max = 4): WhyLine[] {
  const out: WhyLine[] = [];
  const workouts = plan.days.filter((x) => x.workout).map((x) => x.workout!);
  const longest = workouts.reduce((m, w) => Math.max(m, w.estimated_minutes), 0);

  if (safety.level === "refer") {
    out.push({
      because: "בשאלון הבריאות סימנת משהו שדורש בדיקה",
      decision: "השבוע אין אימונים, רק הרגלים ותנועה קלה, עד שרופא יאשר.",
    });
  } else if (safety.restrictions.lowIntensityOnly) {
    out.push({ because: "בשאלון הבריאות סימנת משהו שמצריך זהירות", decision: "כל התרגילים ברמת מתחילים ובעצימות נמוכה." });
  }

  if (d.session_minutes && workouts.length) {
    out.push({
      because: `ציינת שיש לך ${d.session_minutes} דקות לאימון`,
      decision: `כל אימון נגמר תוך ${longest} דקות לכל היותר, כולל חימום, מנוחות ומעבר בין תרגילים.`,
    });
  }

  const goal = d.goals[0] ? GOAL[d.goals[0]] : undefined;
  const goalDecision = goal?.decision(plan, d);
  if (goal && goalDecision) out.push({ because: `המטרה שבחרת היא ${goal.label}`, decision: goalDecision });

  if (workouts.length && d.location.length) {
    const gym = d.location.includes("gym");
    const gear = d.equipment.filter((e) => e !== "none" && e !== "mat");
    if (gym) out.push({ because: "ציינת שאפשר להתאמן בחדר כושר", decision: "התרגילים יכולים להשתמש במכשירים ובמשקולות שיש שם." });
    else if (!gear.length)
      out.push({ because: "ציינת שתתאמנו בבית בלי ציוד", decision: "בחרנו רק תרגילים במשקל גוף, שאפשר לעשות על הרצפה בסלון." });
    else out.push({ because: "ציינת איזה ציוד יש לך בבית", decision: "התרגילים משתמשים רק בציוד הזה ובמשקל גוף." });
  }

  const blocked = [...blockedTags({ limitations: d.limitations, safety })].filter((t) => AREA[t]);
  if (blocked.length) {
    const areas = list(blocked.map((t) => AREA[t]));
    out.push({ because: `ציינת רגישות ב${areas.replace(/^ה/, "")}`, decision: `הוצאנו מהתוכנית תרגילים שמעמיסים על ${areas}.` });
  }

  if (d.allergies.length || (d.dietary_pattern && DIET_HE[d.dietary_pattern])) {
    const parts = [
      d.dietary_pattern && DIET_HE[d.dietary_pattern] ? `תזונה ${DIET_HE[d.dietary_pattern]}` : "",
      d.allergies.length ? `רגישות ל${list(d.allergies.map((a) => ALLERGEN_HE[a] ?? a))}` : "",
    ].filter(Boolean);
    out.push({ because: `ציינת ${parts.join(" ו")}`, decision: "כל רעיונות הארוחות והחלופות סוננו לפי זה." });
  }

  if (workouts.length && d.available_days.length) {
    out.push({
      because: `סימנת ${d.available_days.length} ימים פנויים${d.busy_days.length ? " וגם ימים עמוסים" : ""}`,
      decision: `${workouts.length} אימונים בשבוע${d.busy_days.length ? ", בימים שאינם עמוסים כשאפשר" : ""}, עם ימי מנוחה ביניהם.`,
    });
  }

  if (d.experience === "beginner" && workouts.length) {
    out.push({ because: "סימנת רמת ניסיון של מתחילים", decision: "התרגילים ברמת מתחילים, עם מעט סטים ומנוחה מלאה ביניהם." });
  }

  return out.slice(0, max);
}
