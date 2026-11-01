import type { Metadata } from "next";
import { CalendarDays, Footprints, Droplets, Moon, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CreatePlanButton } from "@/components/plan/create-plan-button";
import { InfoButton } from "@/components/knowledge/info-button";
import { MealsCard } from "@/components/plan/meals-card";
import { WhyCard } from "@/components/plan/why-card";
import { personalNote } from "@/lib/knowledge/personal";
import { GOAL_GUIDE, goalKind, mealFrame, mealRanges } from "@/lib/nutrition/frame";
import { WorkoutCard } from "@/components/plan/workout-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { getProfileSummary } from "@/lib/data/profile";
import { requireUser } from "@/lib/data/user";
import { getDictionary } from "@/lib/i18n/he";
import { loadOnboarding } from "@/lib/onboarding/data";
import { loadWeek } from "@/lib/plan/data";
import { whyThisPlan } from "@/lib/plan/why";
import { screenSafety } from "@/lib/safety/screen";
import { SLOT_HE } from "@/lib/plan/tasks";
import { weekdayOf, weekStartOf } from "@/lib/plan/week";
import { localDay } from "@/lib/water/time";

const t = getDictionary();
const s = t.screens.plan;

export const metadata: Metadata = { title: s.title };

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Plan searchParams={searchParams} />
    </Suspense>
  );
}

const HABIT_ICON = { movement: Footprints, water: Droplets, recovery: Moon, habit: Sparkles } as const;
const dayName = new Intl.DateTimeFormat("he-IL", { weekday: "short", timeZone: "UTC" });
const dayNum = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

async function Plan({ searchParams }: { searchParams: PageProps<"/plan">["searchParams"] }) {
  const user = await requireUser();
  const today = localDay(new Date()).date;
  const weekStart = weekStartOf(today);
  const [profile, week, sp, onboarding] = await Promise.all([
    getProfileSummary(user.id),
    loadWeek(user.id, weekStart),
    searchParams,
    loadOnboarding(user.id),
  ]);

  if (!week) {
    const ready = Boolean(profile?.onboarding_completed_at);
    return (
      <>
        <PageHeader title={s.title} />
        <EmptyState
          icon={<CalendarDays aria-hidden="true" className="size-6" />}
          title={ready ? s.noPlanTitle : s.notReadyTitle}
          body={ready ? s.emptyBody : s.notReadyBody}
          action={ready ? <CreatePlanButton /> : undefined}
        />
      </>
    );
  }

  const { plan } = week;
  const raw = Number(Array.isArray(sp.d) ? sp.d[0] : sp.d);
  const selected = Number.isInteger(raw) && raw >= 0 && raw <= 6 ? raw : weekdayOf(today);
  const day = plan.days[selected];
  const at = (d: string) => new Date(`${d}T00:00:00Z`);
  const draft = onboarding.draft;
  const why = whyThisPlan(draft, plan, screenSafety(draft));
  // Plans saved before the time fix may run over the minutes the user has (follow-up spec §4).
  const budget = draft.session_minutes;
  const goal = goalKind(draft);
  const ranges = mealRanges(
    day.meals.map((m) => m.slot),
    plan.targets.calories_range,
  );
  const ctx = { draft, plan };
  const stale = plan.days.some((d) => d.workout && (d.workout.budget_minutes === undefined || (budget && d.workout.estimated_minutes > budget)));

  return (
    <>
      <PageHeader title={s.title} subtitle={plan.summary.focus} />

      <nav aria-label={s.daysLabel}>
        <ol className="grid grid-cols-7 gap-1 rounded-2xl bg-surface p-1.5 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
          {plan.days.map((d, i) => (
            <li key={d.date}>
              <Link
                href={`/plan?d=${i}`}
                scroll={false}
                aria-current={i === selected ? "page" : undefined}
                aria-label={fullDate.format(at(d.date))}
                className={`flex flex-col items-center gap-1 rounded-xl py-2.5 transition-colors ${
                  i === selected ? "bg-night text-white" : "text-ink-muted hover:bg-field hover:text-ink"
                }`}
              >
                <span className="text-xs">{dayName.format(at(d.date))}</span>
                <span className="num text-base font-semibold">{dayNum.format(at(d.date))}</span>
                <span className={`size-1.5 rounded-full ${d.workout ? "bg-accent" : "bg-transparent"}`} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <h2 className="text-lg font-semibold">
        {fullDate.format(at(day.date))}
        {day.date === today ? <span className="ms-2 text-sm font-normal text-ink-muted">{s.today}</span> : null}
      </h2>

      {stale ? (
        <Card className="flex flex-col gap-3 bg-warning-soft">
          <p className="text-sm text-warning">
            עדכנו את חישוב זמן האימון כך שיכלול חימום ומנוחות ולא יעבור את הזמן שבחרת. כדאי ליצור את התוכנית מחדש כדי לקבל אימונים באורך הנכון. משימות שכבר סימנת נשמרות.
          </p>
          <CreatePlanButton again />
        </Card>
      ) : null}

      {day.workout ? (
        <WorkoutCard
          key={`${selected}-${sp.full ? "full" : "short"}`}
          workout={day.workout}
          exercises={week.exercises}
          date={day.date}
          dayIndex={selected}
          showFull={sp.full === "1"}
          strengthNote={personalNote("strength", ctx)}
        />
      ) : (
        <Card className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lilac-soft text-lilac">
            <Moon aria-hidden="true" className="size-5" />
          </span>
          <p className="flex-1 text-sm">{s.restDay}</p>
          <InfoButton topic="rest" personal={personalNote("rest", ctx)} />
        </Card>
      )}

      {day.meals.length ? (
        <MealsCard
          key={selected}
          guide={GOAL_GUIDE[goal]}
          platePersonal={personalNote("plate", ctx)}
          caloriesPersonal={personalNote("calories", ctx)}
          meals={day.meals.map((m, i) => {
            const idea = week.meals.get(m.meal_idea_id);
            const frame = mealFrame(m.slot, draft, goal, selected);
            return {
              slotLabel: SLOT_HE[m.slot],
              range: ranges[i],
              groups: frame.groups,
              examples: frame.examples,
              idea: idea ? { title: idea.title_he, hint: idea.hint_he } : null,
              alternatives: m.alternatives.map((id) => week.meals.get(id)?.title_he).filter((x): x is string => Boolean(x)),
            };
          })}
        />
      ) : null}

      <Card className="flex flex-col gap-3">
        <h3 className="font-semibold">{s.habitsTitle}</h3>
        <ul className="flex flex-col gap-2">
          {day.habits.map((h, i) => {
            const Icon = HABIT_ICON[h.type];
            return (
              <li key={i} className="flex items-center gap-3">
                <Icon aria-hidden="true" className="size-5 text-lilac" />
                <span>{h.title}</span>
                {h.target ? <span className="text-sm text-ink-muted">{h.target}</span> : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <WhyCard lines={why} />

      <Card className="flex flex-col gap-3">
        <h3 className="font-semibold">{s.whyTitle}</h3>
        <p className="text-sm leading-relaxed text-ink-muted">{plan.explanation}</p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-field p-3">
            <dt className="text-xs text-ink-muted">{s.targets.workouts}</dt>
            <dd className="num text-lg font-semibold">{plan.targets.workouts_per_week}</dd>
          </div>
          <div className="rounded-xl bg-field p-3">
            <dt className="flex items-center justify-center text-xs text-ink-muted">
              {s.targets.water}
              <InfoButton topic="water" personal={personalNote("water", ctx)} />
            </dt>
            <dd className="num text-lg font-semibold">{plan.targets.water_ml ? (plan.targets.water_ml / 1000).toFixed(1) : "—"}</dd>
          </div>
          <div className="rounded-xl bg-field p-3">
            <dt className="flex items-center justify-center text-xs text-ink-muted">
              {s.targets.calories}
              <InfoButton topic="calories" personal={personalNote("calories", ctx)} />
            </dt>
            <dd className="num text-sm font-semibold" dir="ltr">
              {plan.targets.calories_range ? `${plan.targets.calories_range[0]}–${plan.targets.calories_range[1]}` : "—"}
            </dd>
          </div>
        </dl>
        <ul className="list-disc ps-5 text-sm text-ink-muted">
          {plan.summary.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Card>

      <CreatePlanButton again />
      <p className="text-center text-xs text-ink-muted">{s.recreateNote}</p>
    </>
  );
}
