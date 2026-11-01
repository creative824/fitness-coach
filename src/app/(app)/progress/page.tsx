import type { Metadata } from "next";
import { Suspense } from "react";
import { WeightCard } from "@/components/progress/weight-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";
import { requireUser } from "@/lib/data/user";
import { getDictionary } from "@/lib/i18n/he";
import Link from "next/link";
import { WeekScoreChart } from "@/components/progress/week-score-chart";
import { addDays, weekStartOf } from "@/lib/plan/week";
import { loadProgress, loadWeekScores } from "@/lib/progress/data";
import { loadFoodRange } from "@/lib/food/data";
import { compareWeeks, summarizeWeek } from "@/lib/progress/trend";
import { localDay } from "@/lib/water/time";

const t = getDictionary();
const s = t.screens.progress;

export const metadata: Metadata = { title: s.title };

export default function ProgressPage({ searchParams }: PageProps<"/progress">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Progress searchParams={searchParams} />
    </Suspense>
  );
}

async function Progress({ searchParams }: { searchParams: PageProps<"/progress">["searchParams"] }) {
  const user = await requireUser();
  const today = localDay(new Date()).date;
  const sp = await searchParams;
  const lastWeek = sp.w === "prev";
  const weekStart = addDays(weekStartOf(today), lastWeek ? -7 : 0);
  const [p, week, food] = await Promise.all([
    loadProgress(user.id, today),
    loadWeekScores(user.id, weekStart),
    loadFoodRange(user.id, weekStart, addDays(weekStart, 6)).catch(() => ({ tracking: true, days: {} })),
  ]);
  const summary = summarizeWeek(week.days, today);
  const comparison = compareWeeks(summary, summarizeWeek(week.previous, today));

  return (
    <>
      <PageHeader title={s.title} />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{lastWeek ? "השבוע שעבר" : "השבוע שלך"}</h2>
          <nav aria-label="בחירת שבוע" className="flex gap-1 rounded-lg bg-field p-1 text-sm">
            <Link href="/progress?w=prev" scroll={false} aria-current={lastWeek ? "page" : undefined} className={`rounded-md px-3 py-1 ${lastWeek ? "bg-surface font-medium shadow-sm" : "text-ink-muted"}`}>
              קודם
            </Link>
            <Link href="/progress" scroll={false} aria-current={lastWeek ? undefined : "page"} className={`rounded-md px-3 py-1 ${lastWeek ? "text-ink-muted" : "bg-surface font-medium shadow-sm"}`}>
              נוכחי
            </Link>
          </nav>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-field p-3">
            <dt className="text-xs text-ink-muted">סך נקודות</dt>
            <dd className="num text-lg font-semibold">{summary.total}</dd>
          </div>
          <div className="rounded-xl bg-field p-3">
            <dt className="text-xs text-ink-muted">ממוצע ליום</dt>
            <dd className="num text-lg font-semibold">{summary.average}</dd>
          </div>
          <div className="rounded-xl bg-field p-3">
            <dt className="text-xs text-ink-muted">ימים פעילים</dt>
            <dd className="num text-lg font-semibold">{summary.activeDays}</dd>
          </div>
        </dl>
        {summary.streak >= 2 && !lastWeek ? (
          <p className="text-sm font-medium">רצף של <span className="num">{summary.streak}</span> ימים עם לפחות משימה אחת. 🔥</p>
        ) : null}
        {comparison && !lastWeek ? <p className="text-sm text-accent-strong">{comparison}</p> : null}
        <WeekScoreChart key={weekStart} days={week.days} today={today} food={food.days} foodTracking={food.tracking} />
        <p className="text-sm text-ink-muted">{s.consistencyNote} לחיצה על יום מציגה מה בוצע בו.</p>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{s.workoutsTitle}</h2>
        <span className="num text-lg font-semibold">
          {p.workoutsDone}
          <span className="text-sm text-ink-muted">/{p.workoutsPlanned}</span>
        </span>
      </Card>

      {p.hideWeight ? (
        <Card>
          <p className="text-sm text-ink-muted">{s.weightHidden}</p>
        </Card>
      ) : (
        <WeightCard initial={p.weights} today={today} />
      )}
    </>
  );
}
