import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, ClipboardList, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { CreatePlanButton } from "@/components/plan/create-plan-button";
import { TodayBoard } from "@/components/today/today-board";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { WeekStrip } from "@/components/ui/week-strip";
import { requireUser } from "@/lib/data/user";
import { getDictionary } from "@/lib/i18n/he";
import { getProfileSummary } from "@/lib/data/profile";
import { WhyCard } from "@/components/plan/why-card";
import { loadOnboarding } from "@/lib/onboarding/data";
import { loadDayTasks, loadWeek } from "@/lib/plan/data";
import { weekdayOf, weekStartOf } from "@/lib/plan/week";
import { whyThisPlan } from "@/lib/plan/why";
import { personalNote } from "@/lib/knowledge/personal";
import { screenSafety } from "@/lib/safety/screen";
import { loadWaterToday } from "@/lib/water/data";
import { localDay } from "@/lib/water/time";

const t = getDictionary();
const s = t.screens.today;

export const metadata: Metadata = { title: s.title };

export default function TodayPage() {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Today />
    </Suspense>
  );
}

/** Tasks of today from the active plan, the daily meter and the water card. */
async function Today() {
  const user = await requireUser();
  const { date, minutes } = localDay(new Date());
  const [profile, day, water, week, onboarding] = await Promise.all([
    getProfileSummary(user.id),
    loadDayTasks(user.id, date).catch(() => ({ hasPlan: false, tasks: [] })),
    // Hidden if the 0002 migration has not run yet.
    loadWaterToday(user.id).catch(() => null),
    loadWeek(user.id, weekStartOf(date)).catch(() => null),
    loadOnboarding(user.id).catch(() => null),
  ]);
  const ctx = { draft: onboarding?.draft ?? null, plan: week?.plan ?? null };
  const notes = Object.fromEntries(
    (["plate", "strength", "walking", "water", "sleep"] as const).map((k) => [k, personalNote(k, ctx)]),
  );
  const why = week && onboarding ? whyThisPlan(onboarding.draft, week.plan, screenSafety(onboarding.draft), 2) : [];
  const name = profile?.display_name;
  const ready = Boolean(profile?.onboarding_completed_at);

  return (
    <>
      <header className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink ring-4 ring-white"
          >
            {name ? name.trim().charAt(0) : <Sparkles className="size-5" />}
          </span>
          <div className="flex flex-col">
            {name ? <span className="text-sm text-ink-muted">{s.greeting.replace("{name}", name)}</span> : null}
            <h1 className="text-2xl leading-tight font-semibold">{s.title}</h1>
          </div>
        </div>
      </header>

      <WeekStrip label={s.weekLabel} />

      {ready ? (
        <TodayBoard
          key={`${date}:${day.tasks.length}:${day.tasks[0]?.id ?? ""}`}
          tasks={day.tasks}
          workoutHref={`/plan?d=${weekdayOf(date)}`}
          notes={notes}
          water={
            water
              ? {
                  ...water,
                  workoutToday: day.tasks.some((x) => x.type === "workout"),
                  nowMin: minutes,
                }
              : null
          }
        />
      ) : null}

      {!ready ? (
        <EmptyState
          icon={<ClipboardList aria-hidden="true" />}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={
            <ButtonLink href="/onboarding">
              {s.emptyCta}
              <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover/btn:-translate-x-0.5" />
            </ButtonLink>
          }
        />
      ) : null}

      {ready && day.hasPlan ? <WhyCard lines={why} compact /> : null}

      {!ready ? null : !day.hasPlan ? (
        <EmptyState icon={<CalendarDays aria-hidden="true" />} title={s.noPlanTitle} body={s.noPlanBody} action={<CreatePlanButton />} />
      ) : (
        <ButtonLink href="/plan" variant="secondary">
          {s.seeWeek}
          <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover/btn:-translate-x-0.5" />
        </ButtonLink>
      )}
    </>
  );
}
