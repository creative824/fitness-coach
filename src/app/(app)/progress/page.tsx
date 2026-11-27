import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DayBars } from "@/components/progress/day-bars";
import { FoodDay, type FoodDayProps } from "@/components/diary/food-day";
import { WeightCard } from "@/components/progress/weight-card";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { loadDayContext } from "@/lib/day/context";
import { loadScores, type SavedScore } from "@/lib/day/score-data";
import { DAILY_WEIGHTS, type DailyPart } from "@/lib/day/scores";
import { requireUser } from "@/lib/data/user";
import { loadFoodDay, loadFoodRange } from "@/lib/food/data";
import { ACTIVITIES, type ActivityKind } from "@/lib/fitness/activities";
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
const dayName = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" });
const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");

export default function ProgressPage({ searchParams }: PageProps<"/progress">) {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Progress searchParams={searchParams} />
    </Suspense>
  );
}

const mid = (r: [number, number] | null | undefined) => (r ? Math.round((r[0] + r[1]) / 2) : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function rangeOf(r: Range, today: string, back: number, day: string): [string, string] {
  if (r === "day") return [day, day];
  if (r === "week") {
    const start = addDays(weekStartOf(today), -7 * back);
    return [start, addDays(start, 6)];
  }
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 - back, 1));
  const last = new Date(Date.UTC(y, m - back, 0));
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

/**
 * Tracking: one day (calories, protein, activity and the food diary by meal) or a week / month
 * (calories and protein per day, averages, workouts), and weight over time.
 */
async function Progress({ searchParams }: { searchParams: PageProps<"/progress">["searchParams"] }) {
  const user = await requireUser();
  const { date: today, minutes } = localDay(new Date());
  const sp = await searchParams;
  const range: Range = sp.r === "week" || sp.r === "month" ? sp.r : "day";
  const back = range === "day" ? 0 : Math.min(24, Math.max(0, Number(sp.b) || 0));
  const askedDay = typeof sp.d === "string" && DATE.test(sp.d) && sp.d <= today ? sp.d : today;
  const [from, to] = rangeOf(range, today, back, askedDay);

  const [ctx, p, food, logs, workouts, foodDay, scores] = await Promise.all([
    loadDayContext(user.id),
    loadProgress(user.id, today),
    loadFoodRange(user.id, from, to).catch(() => ({ tracking: true, days: {} as Awaited<ReturnType<typeof loadFoodRange>>["days"] })),
    loadDayLogRange(user.id, from, to),
    loadWorkoutDays(user.id, from, to),
    range === "day" ? loadFoodDay(user.id, askedDay).catch(() => null) : Promise.resolve(null),
    loadScores(user.id, from, to).catch(() => new Map<string, SavedScore>()),
  ]);
  const target = ctx.showNumbers ? ctx.target : null;
  const protein = ctx.protein;

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <nav aria-label="טווח" className="flex rounded-xl bg-surface p-1 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
          {RANGES.map(([k, l]) => (
            <Link
              key={k}
              href={`/progress?r=${k}`}
              scroll={false}
              aria-current={range === k ? "page" : undefined}
              className={`flex min-h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium transition-colors ${range === k ? "bg-night text-white" : "text-ink-muted hover:text-ink"}`}
            >
              {l}
            </Link>
          ))}
        </nav>
      </header>

      {range === "day" ? (
        <DayView
          day={askedDay}
          today={today}
          target={target}
          protein={protein}
          workout={workouts[askedDay] ?? null}
          acts={logs.get(askedDay)?.fitness.acts ?? []}
          foodDay={foodDay}
          tracking={ctx.showNumbers}
          score={askedDay < today ? (scores.get(askedDay) ?? null) : null}
          diary={{
            ideaContext: { target, proteinTarget: protein, profile: ctx.profile, taste: ctx.taste, minutes },
            planned: ctx.planned,
            open: sp.open === "add" || sp.open === "idea" ? sp.open : null,
          }}
        />
      ) : (
        <PeriodView
          range={range}
          back={back}
          from={from}
          to={to}
          today={today}
          target={target}
          protein={protein}
          food={food.days}
          workouts={workouts}
          scores={scores}
          activeMin={[...logs.values()].reduce((a, l) => a + l.fitness.acts.reduce((x, y) => x + y.min, 0), 0)}
        />
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

function Stepper({ label, prev, next }: { label: string; prev: string | null; next: string | null }) {
  const btn = "flex size-10 items-center justify-center rounded-xl bg-surface shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] hover:bg-white";
  return (
    <div className="flex items-center justify-between gap-2">
      {prev ? (
        <Link href={prev} scroll={false} aria-label="הקודם" className={btn}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      ) : (
        <span className="size-10" />
      )}
      <span className="text-center font-semibold">{label}</span>
      {next ? (
        <Link href={next} scroll={false} aria-label="הבא" className={btn}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
      ) : (
        <span className="size-10" />
      )}
    </div>
  );
}

function DayView({
  day,
  today,
  target,
  protein,
  workout,
  acts,
  foodDay,
  tracking,
  score,
  diary,
}: {
  score: SavedScore | null;
  day: string;
  today: string;
  target: number | null;
  protein: number | null;
  diary: Pick<FoodDayProps, "ideaContext" | "planned" | "open">;
  workout: "done" | "partial" | "planned" | null;
  acts: { kind: string; min: number }[];
  foodDay: Awaited<ReturnType<typeof loadFoodDay>> | null;
  tracking: boolean;
}) {
  const minutes = acts.reduce((a, x) => a + x.min, 0);
  const label = day === today ? "היום" : day === addDays(today, -1) ? "אתמול" : dayName.format(new Date(`${day}T12:00:00Z`));
  const next = day < today ? (addDays(day, 1) === today ? "/progress?r=day" : `/progress?r=day&d=${addDays(day, 1)}`) : null;
  return (
    <>
      <Stepper label={label} prev={`/progress?r=day&d=${addDays(day, -1)}`} next={next} />
      {score ? <PastScore score={score} /> : null}
      <FoodDay
        dateLabel={dayName.format(new Date(`${day}T12:00:00Z`))}
        isToday={day === today}
        meals={(foodDay?.logs ?? []).map((l) => ({ id: l.id, mealType: l.mealType, text: l.text, loggedAt: l.loggedAt, status: l.status, items: l.items, source: l.source }))}
        target={target}
        proteinTarget={protein}
        showNumbers={tracking}
        {...diary}
      />
      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <Dumbbell aria-hidden="true" className="size-4" />
          פעילות גופנית
        </h2>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-ink-muted">אימון</dt>
            <dd className="text-xl font-semibold">{workout === "done" ? "הושלם" : workout === "partial" ? "חלקי" : workout === "planned" ? (day === today ? "מחכה" : "לא בוצע") : "יום מנוחה"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">דקות פעילות</dt>
            <dd className="num text-xl font-semibold">{minutes}</dd>
          </div>
        </dl>
        {acts.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {acts.map((a, i) => (
              <li key={i} className="rounded-full bg-field px-3 py-1 text-xs">
                {ACTIVITIES[a.kind as ActivityKind]?.label ?? a.kind} <span className="num">{a.min}</span> דק׳
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

function PeriodView({
  range,
  back,
  from,
  to,
  today,
  target,
  protein,
  food,
  workouts,
  activeMin,
  scores,
}: {
  scores: Map<string, SavedScore>;
  range: "week" | "month";
  back: number;
  from: string;
  to: string;
  today: string;
  target: number | null;
  protein: number | null;
  food: Awaited<ReturnType<typeof loadFoodRange>>["days"];
  workouts: Record<string, "done" | "partial" | "planned">;
  activeMin: number;
}) {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  const kcal = dates.map((d) => ({ date: d, value: mid(food[d]?.totals.kcal) }));
  const prot = dates.map((d) => ({ date: d, value: food[d]?.totals.protein ? Math.round(food[d]!.totals.protein!) : null }));
  const loggedK = kcal.filter((d) => d.value && d.date <= today);
  const loggedP = prot.filter((d) => d.value && d.date <= today);
  const avgK = loggedK.length ? loggedK.reduce((a, d) => a + d.value!, 0) / loggedK.length : null;
  const avgP = loggedP.length ? loggedP.reduce((a, d) => a + d.value!, 0) / loggedP.length : null;
  const onTarget = target ? loggedK.filter((d) => d.value! <= target * 1.1 && d.value! >= target * 0.8).length : 0;
  const balance = target ? loggedK.reduce((a, d) => a + d.value! - target, 0) : 0;
  const marks = Object.entries(workouts).filter(([d]) => d >= from && d <= to);
  const scoreDays = dates.map((d) => ({ date: d, value: scores.get(d)?.score ?? null }));
  const scored = scoreDays.filter((d) => d.value !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((a, d) => a + d.value!, 0) / scored.length) : null;
  const wDone = marks.filter(([, w]) => w === "done" || w === "partial").length;
  const label =
    range === "month"
      ? monthName.format(new Date(`${from}T00:00:00Z`))
      : back === 0
        ? "השבוע"
        : back === 1
          ? "השבוע שעבר"
          : `${shortDate.format(new Date(`${from}T12:00:00Z`))}–${shortDate.format(new Date(`${to}T12:00:00Z`))}`;
  return (
    <>
      <Stepper label={label} prev={`/progress?r=${range}&b=${back + 1}`} next={back > 0 ? `/progress?r=${range}${back > 1 ? `&b=${back - 1}` : ""}` : null} />
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="ציון יומי ממוצע" value={avgScore !== null ? String(avgScore) : "–"} />
        <Stat label="ממוצע קלוריות" value={target && avgK ? fmt(avgK) : "–"} />
        <Stat label="ממוצע חלבון" value={protein && avgP ? `${fmt(avgP)} ג׳` : "–"} />
        <Stat label="אימונים" value={`${wDone}/${marks.length}`} />
      </dl>
      {scored.length ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">ציון יומי</h2>
          <DayBars days={scoreDays} target={null} today={today} kind="score" label="ציון יומי לפי יום" />
        </Card>
      ) : null}
      {target ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">קלוריות לפי ימים</h2>
            <span className="text-xs text-ink-muted">
              <span className="num">{onTarget}</span> ימים ביעד
            </span>
          </div>
          <DayBars days={kcal} target={target} today={today} kind="calories" label="קלוריות לפי יום" />
          {loggedK.length ? (
            <p className={`rounded-xl px-3 py-2 text-sm ${balance <= 0 ? "bg-accent-soft" : "bg-coral-soft"}`}>
              מאזן מול היעד:{" "}
              <span className="num font-semibold" dir="ltr">
                {balance > 0 ? "+" : balance < 0 ? "−" : ""}
                {fmt(Math.abs(balance))}
              </span>{" "}
              קל׳
              {Math.abs(balance) >= 770 ? (
                <>
                  {" "}
                  (בערך <span className="num">{(Math.abs(balance) / 7700).toFixed(1)}</span> ק״ג {balance < 0 ? "פחות" : "יותר"})
                </>
              ) : null}
            </p>
          ) : null}
        </Card>
      ) : null}
      {protein ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">חלבון לפי ימים</h2>
          <DayBars days={prot} target={protein} today={today} kind="protein" label="חלבון לפי יום" />
        </Card>
      ) : null}
      {activeMin ? (
        <p className="text-sm text-ink-muted">
          פעילות נוספת בתקופה: <span className="num">{activeMin}</span> דק׳.
        </p>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="num mt-0.5 text-xl font-bold">{value}</dd>
    </div>
  );
}

const PART_LABEL: Record<DailyPart, string> = { calories: "קלוריות", protein: "חלבון", fitness: "כושר", tasks: "משימות" };

/** The score a past day ended with, as it was saved on that day. */
function PastScore({ score }: { score: SavedScore }) {
  return (
    <section className="flex items-center gap-4 rounded-[var(--radius-card)] bg-night p-4 text-white shadow-[var(--shadow-card)]">
      <div className="flex flex-col items-center leading-none">
        <span className="num text-4xl font-bold">{score.score}</span>
        <span className="mt-1 text-[11px] text-white/55">ציון יומי</span>
      </div>
      <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {(Object.keys(DAILY_WEIGHTS) as DailyPart[]).map((k) => (
          <div key={k} className="flex justify-between gap-1">
            <dt className="text-white/65">{PART_LABEL[k]}</dt>
            <dd className="num">
              {score.points[k] ?? "–"}
              <span className="text-xs text-white/45">/{DAILY_WEIGHTS[k]}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
