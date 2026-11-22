import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FoodList } from "@/components/food/food-list";
import { CalorieRing } from "@/components/home/calorie-ring";
import { MonthGrid, tone, WeekBars, type CalorieDay } from "@/components/progress/calorie-chart";
import { WeightCard } from "@/components/progress/weight-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";
import { loadDayContext } from "@/lib/day/context";
import { requireUser } from "@/lib/data/user";
import { loadFoodDay, loadFoodRange } from "@/lib/food/data";
import { getDictionary } from "@/lib/i18n/he";
import { loadDayLogRange } from "@/lib/menu/data";
import { addDays, weekStartOf } from "@/lib/plan/week";
import { loadProgress, loadWorkoutDays } from "@/lib/progress/data";
import { localDay } from "@/lib/water/time";

const t = getDictionary();
const s = t.screens.progress;

export const metadata: Metadata = { title: s.title };

type Range = "day" | "week" | "month";
const RANGES: [Range, string][] = [
  ["day", "יום"],
  ["week", "שבוע"],
  ["month", "חודש"],
];
const monthName = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" });

export default function ProgressPage({ searchParams }: PageProps<"/progress">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Progress searchParams={searchParams} />
    </Suspense>
  );
}

const mid = (r: [number, number] | null | undefined) => (r ? Math.round((r[0] + r[1]) / 2) : null);

function rangeOf(r: Range, today: string, back: number): [string, string] {
  if (r === "day") return [today, today];
  if (r === "week") {
    const start = addDays(weekStartOf(today), -7 * back);
    return [start, addDays(start, 6)];
  }
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 - back, 1));
  const last = new Date(Date.UTC(y, m - back, 0));
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

async function Progress({ searchParams }: { searchParams: PageProps<"/progress">["searchParams"] }) {
  const user = await requireUser();
  const today = localDay(new Date()).date;
  const sp = await searchParams;
  const range: Range = sp.r === "day" || sp.r === "month" ? sp.r : "week";
  const back = sp.b === "1" && range !== "day" ? 1 : 0;
  const [from, to] = rangeOf(range, today, back);

  const [ctx, p, food, logs, workouts, foodDay] = await Promise.all([
    loadDayContext(user.id),
    loadProgress(user.id, today),
    loadFoodRange(user.id, from, to).catch(() => ({ tracking: true, days: {} as Awaited<ReturnType<typeof loadFoodRange>>["days"] })),
    loadDayLogRange(user.id, from, to),
    loadWorkoutDays(user.id, from, to),
    range === "day" ? loadFoodDay(user.id, today).catch(() => null) : Promise.resolve(null),
  ]);
  const target = ctx.showNumbers ? ctx.target : null;

  const days: CalorieDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days.push({
      date: d,
      kcal: mid(food.days[d]?.totals.kcal),
      workout: workouts[d] ?? null,
      activeMin: logs.get(d)?.fitness.acts.reduce((a, x) => a + x.min, 0) ?? 0,
    });
  }
  const past = days.filter((d) => d.date <= today);
  const logged = past.filter((d) => d.kcal);
  const avg = logged.length ? Math.round(logged.reduce((a, d) => a + (d.kcal ?? 0), 0) / logged.length) : null;
  const onTarget = logged.filter((d) => tone(d.kcal, target) === "on").length;
  const wDone = days.filter((d) => d.workout === "done" || d.workout === "partial").length;
  const wPlanned = days.filter((d) => d.workout).length;
  const activeMin = days.reduce((a, d) => a + d.activeMin, 0);
  const label = range === "month" ? monthName.format(new Date(`${from}T00:00:00Z`)) : range === "week" ? (back ? "השבוע שעבר" : "השבוע") : "היום";

  return (
    <>
      <PageHeader title={s.title} />

      <nav aria-label="טווח" className="flex rounded-xl bg-surface p-1 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
        {RANGES.map(([k, l]) => (
          <Link
            key={k}
            href={`/progress?r=${k}`}
            scroll={false}
            aria-current={range === k ? "page" : undefined}
            className={`flex min-h-10 flex-1 items-center justify-center rounded-lg text-sm font-medium transition-colors ${range === k ? "bg-night text-white" : "text-ink-muted hover:text-ink"}`}
          >
            {l}
          </Link>
        ))}
      </nav>

      {range === "day" ? (
        <Card className="flex flex-col gap-4">
          {target ? (
            <div className="flex items-center gap-4 rounded-xl bg-night p-4 text-white">
              <CalorieRing eaten={mid(foodDay?.totals.kcal) ?? 0} target={target} size={112} />
              <dl className="grid flex-1 grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["חלבון", foodDay?.totals.protein],
                    ["פחמימות", foodDay?.totals.carbs],
                    ["שומן", foodDay?.totals.fat],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] text-white/60">{k}</dt>
                    <dd className="num text-lg font-semibold">{v ?? "–"}</dd>
                    <dd className="text-[10px] text-white/50">גרם</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">מה נאכל היום</h2>
            <Link href="/food" className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
              יומן מלא
            </Link>
          </div>
          <FoodList logs={foodDay?.logs ?? []} tracking={Boolean(target)} />
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{label}</h2>
            <nav aria-label="תקופה" className="flex gap-1 rounded-lg bg-field p-1 text-sm">
              <Link href={`/progress?r=${range}&b=1`} scroll={false} aria-current={back ? "page" : undefined} className={`rounded-md px-3 py-1 ${back ? "bg-surface font-medium shadow-sm" : "text-ink-muted"}`}>
                קודם
              </Link>
              <Link href={`/progress?r=${range}`} scroll={false} aria-current={back ? undefined : "page"} className={`rounded-md px-3 py-1 ${back ? "text-ink-muted" : "bg-surface font-medium shadow-sm"}`}>
                נוכחי
              </Link>
            </nav>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="ממוצע ליום" value={target && avg ? avg.toLocaleString("he-IL") : "–"} unit={target && avg ? "קל׳" : undefined} />
            <Stat label="ימים ביעד" value={target ? `${onTarget}/${logged.length}` : "–"} />
            <Stat label="אימונים" value={`${wDone}/${wPlanned}`} />
          </dl>

          {range === "week" ? <WeekBars days={days} target={target} today={today} /> : <MonthGrid days={days} target={target} today={today} />}

          <p className="text-xs text-ink-muted">
            {target ? (
              <>
                היעד היומי שלך: <span className="num">{target.toLocaleString("he-IL")}</span> קל׳. יום &quot;ביעד&quot; הוא עד 10% מעליו ועד 20% מתחתיו.{" "}
              </>
            ) : null}
            {activeMin ? (
              <>
                פעילות נוספת: <span className="num">{activeMin}</span> דק׳.
              </>
            ) : null}
          </p>
        </Card>
      )}

      {p.hideWeight || ctx.hideWeight ? (
        <Card>
          <p className="text-sm text-ink-muted">{s.weightHidden}</p>
        </Card>
      ) : (
        <WeightCard initial={p.weights} today={today} heightCm={ctx.heightCm} fallbackKg={ctx.weightKg} />
      )}
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-field p-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="num text-lg font-semibold">
        {value}
        {unit ? <span className="text-xs font-normal text-ink-muted"> {unit}</span> : null}
      </dd>
    </div>
  );
}
