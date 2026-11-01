"use client";

import { Flame } from "lucide-react";
import { InfoButton } from "@/components/knowledge/info-button";
import { Card } from "@/components/ui/card";
import type { GoalType, OnboardingDraft } from "@/lib/onboarding/schema";
import { calorieTarget } from "@/lib/plan/targets";
import type { SafetyResult } from "@/lib/safety/screen";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Explains the adjustment in one sentence, with the expected pace. */
export function adjustLine(adjust: number, kgPerWeek: number): string {
  const pace = Math.abs(kgPerWeek).toFixed(2).replace(/0$/, "");
  if (adjust < 0) return `פחות ${fmt(-adjust)} ביום, כדי לרדת בערך ${pace} ק״ג בשבוע. קצב כזה עוזר לשמור על השריר בזמן הירידה.`;
  if (adjust > 0) return `עוד ${fmt(adjust)} ביום, תוספת קטנה שמספיקה לבניית שריר ומגבילה עלייה בשומן.`;
  return "זה בערך מה שהגוף צריך כדי לשמור על המשקל.";
}

/** Rough weeks to the target weight at the planned pace, only when it is in the goal's direction. */
export function weeksToTarget(weight: number | null, target: number | null, kgPerWeek: number): number | null {
  if (!weight || !target || !kgPerWeek) return null;
  const diff = target - weight;
  if (Math.sign(diff) !== Math.sign(kgPerWeek)) return null;
  return Math.round(diff / kgPerWeek);
}

/**
 * The daily calorie target, shown at the end of the questionnaire: the number, where it comes
 * from, and the pace it implies. Hidden when the safety screen rules out a calorie target.
 */
export function CalorieTargetCard({ draft, safety, goals }: { draft: OnboardingDraft; safety: SafetyResult; goals: GoalType[] }) {
  const cal = calorieTarget({
    age: draft.age,
    heightCm: draft.height_cm,
    weightKg: draft.weight_kg,
    sex: draft.sex,
    activityLevel: draft.activity_level,
    goals,
    experience: draft.experience,
    availableDays: draft.available_days,
    safety,
  });
  if (!cal) return null;
  const weeks = weeksToTarget(draft.weight_kg, draft.target_weight_kg, cal.kgPerWeek);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold">
          <Flame aria-hidden="true" className="size-5 text-coral" />
          היעד היומי שלך
        </h3>
        <InfoButton topic="calories" />
      </div>
      <p>
        <span className="num text-3xl font-bold">{fmt(cal.kcal)}</span> <span className="text-ink-muted">קלוריות ביום, בערך</span>
      </p>
      <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
        <li>הגוף שלך משתמש בערך ב-{fmt(cal.maintenance)} ביום, לפי הגיל, הגובה, המשקל והפעילות שמילאת.</li>
        <li>{adjustLine(cal.adjust, cal.kgPerWeek)}</li>
        {weeks ? <li>בקצב הזה, למשקל היעד שלך מגיעים בערך בעוד {weeks} שבועות.</li> : null}
        {!cal.precise ? <li>בלי לציין מין הטווח רחב יותר: {fmt(cal.range[0])}–{fmt(cal.range[1])}.</li> : null}
      </ul>
      <p className="text-xs text-ink-muted">זו הערכה ונקודת התחלה. התוכנית תחלק את היעד בין הארוחות.</p>
    </Card>
  );
}
