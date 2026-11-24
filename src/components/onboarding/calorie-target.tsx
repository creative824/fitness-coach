"use client";

import { AlertTriangle, CalendarDays, Flame, Target } from "lucide-react";
import { InfoButton } from "@/components/knowledge/info-button";
import { Card } from "@/components/ui/card";
import { proteinTarget } from "@/lib/day/scores";
import type { GoalType, OnboardingDraft } from "@/lib/onboarding/schema";
import { activeMinutesTarget, calorieTarget, workoutsPerWeek } from "@/lib/plan/targets";
import type { SafetyResult } from "@/lib/safety/screen";

const fmt = (n: number) => n.toLocaleString("he-IL");
const longDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const showDate = (d: string) => longDate.format(new Date(`${d}T12:00:00Z`));
const todayIso = () => new Date().toISOString().slice(0, 10);
const addMonths = (d: string, m: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + m);
  return x.toISOString().slice(0, 10);
};

/**
 * The goal and the numbers, at the end of the questionnaire: the target weight and the date to
 * reach it, a check that the pace is healthy (with a recommended date when it is not), and what
 * the app works out: BMR, daily use, the calorie target, protein, activity and the expected pace.
 */
export function CalorieTargetCard({
  draft,
  safety,
  goals,
  onChange,
}: {
  draft: OnboardingDraft;
  safety: SafetyResult;
  goals: GoalType[];
  onChange: (patch: Partial<Pick<OnboardingDraft, "target_weight_kg" | "target_date">>) => void;
}) {
  const today = todayIso();
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
    targetWeightKg: draft.target_weight_kg,
    targetDate: draft.target_date,
    today,
  });
  if (!cal) return null;
  const protein = proteinTarget(goals, draft.weight_kg, { heightCm: draft.height_cm, activityLevel: draft.activity_level });
  const workouts = workoutsPerWeek({ age: draft.age, heightCm: draft.height_cm, weightKg: draft.weight_kg, activityLevel: draft.activity_level, goals, experience: draft.experience, availableDays: draft.available_days, safety });
  const pace = cal.pace;
  const wantsChange = goals.includes("lose_weight") || goals.includes("gain_weight") || goals.includes("muscle");
  const choices = [2, 3, 4, 6].map((m) => ({ m, date: addMonths(today, m) }));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold">
          <Target aria-hidden="true" className="size-5" />
          היעד שלך
        </h3>
        <InfoButton topic="calories" />
      </div>

      {wantsChange ? (
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">משקל יעד (ק״ג)</span>
            <input
              type="number"
              inputMode="decimal"
              dir="ltr"
              min={35}
              max={300}
              step={0.5}
              value={draft.target_weight_kg ?? ""}
              onChange={(e) => onChange({ target_weight_kg: e.target.value === "" ? null : Number(e.target.value) })}
              className="num h-11 w-28 rounded-xl bg-field px-3 text-center text-lg font-semibold ring-1 ring-line focus:ring-ink/40 focus:outline-none"
            />
          </label>
          {draft.target_weight_kg ? (
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays aria-hidden="true" className="size-4" />
                עד מתי?
              </span>
              <div className="flex flex-wrap gap-2">
                {choices.map((c) => (
                  <button
                    key={c.m}
                    type="button"
                    aria-pressed={draft.target_date === c.date}
                    onClick={() => onChange({ target_date: c.date })}
                    className={`min-h-10 cursor-pointer rounded-xl px-3 text-sm font-medium ring-1 transition-colors ${draft.target_date === c.date ? "bg-night text-white ring-night" : "bg-surface ring-line hover:ring-ink/30"}`}
                  >
                    {c.m} חודשים
                  </button>
                ))}
                <input
                  type="date"
                  aria-label="תאריך יעד"
                  min={today}
                  value={draft.target_date ?? ""}
                  onChange={(e) => onChange({ target_date: e.target.value || null })}
                  className="h-10 rounded-xl bg-field px-3 text-sm ring-1 ring-line"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">אפשר גם בלי משקל יעד. אז נתכנן קצב מתון וקבוע.</p>
          )}

          {pace?.tooFast ? (
            <div role="alert" className="flex flex-col gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
              <p className="flex items-start gap-2">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                היעד שבחרת דורש ירידה מהירה מדי במשקל. כדי לשמור על תהליך בריא ובר קיימא, אנחנו ממליצים על קצב מתון יותר.
              </p>
              <button
                type="button"
                onClick={() => onChange({ target_date: pace.recommendedDate })}
                className="min-h-10 cursor-pointer self-start rounded-xl bg-night px-3 text-sm font-medium text-white"
              >
                לבחור את התאריך המומלץ: {showDate(pace.recommendedDate)}
              </button>
            </div>
          ) : pace && !draft.target_date ? (
            <p className="text-sm text-ink-muted">
              תאריך מומלץ בקצב מתון: <span className="font-medium text-ink">{showDate(pace.recommendedDate)}</span>.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 rounded-xl bg-night p-4 text-white">
        <span className="flex items-center gap-1.5 text-sm text-white/70">
          <Flame aria-hidden="true" className="size-4 text-coral" />
          היעד היומי שלך
        </span>
        <p>
          <span className="num text-3xl font-bold">{fmt(cal.kcal)}</span> <span className="text-white/70">קלוריות ביום</span>
        </p>
        {protein ? (
          <p className="text-sm text-white/80">
            ו-<span className="num font-semibold text-white">{protein}</span> גרם חלבון ביום
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Row label="חילוף חומרים בסיסי (BMR)" value={`${fmt(cal.bmr)} קל׳`} />
        <Row label="הוצאה יומית (TDEE)" value={`${fmt(cal.maintenance)} קל׳`} />
        <Row label="קצב שבועי צפוי" value={cal.kgPerWeek ? `${cal.kgPerWeek > 0 ? "+" : "−"}${Math.abs(cal.kgPerWeek).toFixed(2)} ק״ג` : "שמירה"} />
        <Row label="פעילות" value={`${workouts} אימונים בשבוע · ${activeMinutesTarget(draft.activity_level)} דק׳ ביום`} />
        {pace?.etaDate ? <Row label="הגעה משוערת ליעד" value={showDate(pace.etaDate)} wide /> : null}
      </dl>
      <p className="text-xs text-ink-muted">
        החישוב לפי נוסחת Mifflin-St Jeor ורמת הפעילות. זו הערכה ונקודת התחלה: כשתעדכן משקל, היעדים יתעדכנו. היעד אף פעם לא יורד מתחת לרף בטוח, וגירעון לא עולה על 1% ממשקל הגוף בשבוע.
        {!cal.precise ? ` בלי לציין מין הטווח רחב יותר: ${fmt(cal.range[0])}–${fmt(cal.range[1])}.` : ""}
      </p>
    </Card>
  );
}

function Row({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-field p-2.5 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="num font-semibold">{value}</dd>
    </div>
  );
}
