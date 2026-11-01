import type { Metadata } from "next";
import { Suspense } from "react";
import { WeightCard } from "@/components/progress/weight-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";
import { requireUser } from "@/lib/data/user";
import { getDictionary } from "@/lib/i18n/he";
import { loadProgress } from "@/lib/progress/data";
import { activeDays } from "@/lib/progress/trend";
import { localDay } from "@/lib/water/time";

const t = getDictionary();
const s = t.screens.progress;

export const metadata: Metadata = { title: s.title };

export default function ProgressPage() {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Progress />
    </Suspense>
  );
}

const dayName = new Intl.DateTimeFormat("he-IL", { weekday: "narrow", timeZone: "UTC" });

async function Progress() {
  const user = await requireUser();
  const today = localDay(new Date()).date;
  const p = await loadProgress(user.id, today);
  const thisWeek = p.days.slice(7);

  return (
    <>
      <PageHeader title={s.title} />

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{s.consistencyTitle}</h2>
          <span className="text-sm text-ink-muted">{s.activeDays(activeDays(thisWeek))}</span>
        </div>
        <ol className="grid items-end gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
          {p.days.map((d) => {
            const ratio = d.possible ? d.earned / d.possible : 0;
            return (
              <li key={d.date} className="flex flex-col items-center gap-1" title={`${d.earned}/${d.possible}`}>
                <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-field">
                  <div className="w-full rounded-md bg-brand transition-[height]" style={{ height: `${Math.round(ratio * 100)}%` }} />
                </div>
                <span className={`text-[10px] ${d.date === today ? "font-bold text-ink" : "text-ink-muted"}`}>
                  {dayName.format(new Date(`${d.date}T00:00:00Z`))}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-ink-muted">{s.consistencyNote}</p>
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
