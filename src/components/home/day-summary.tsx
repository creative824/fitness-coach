"use client";

import { Beef, ChevronLeft, Flame, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveDayScore } from "@/lib/day/score-actions";
import { calorieScore, dailyScore, DAILY_WEIGHTS, type DailyPart } from "@/lib/day/scores";
import { dayMessage } from "@/lib/day/message";
import { fmt, useDay } from "./day-context";

const PART_LABEL: Record<DailyPart, string> = { calories: "קלוריות", protein: "חלבון", fitness: "כושר", tasks: "משימות" };

/** Minutes since local midnight, read on the client after hydration (the server's guess before). */
function useMinutes(initial: number) {
  const [m, setM] = useState(initial);
  useEffect(() => {
    const now = () => {
      const d = new Date();
      setM(d.getHours() * 60 + d.getMinutes());
    };
    now();
    const id = setInterval(now, 60_000);
    return () => clearInterval(id);
  }, []);
  return m;
}

/** Everything the summary needs from the day, worked out once for both cards. */
function useSummary(target: number | null, proteinTarget: number | null, minutes: number) {
  const { eatenKcal, eatenProtein, workout, tasks, activeMinutes } = useDay();
  const kcal = target ? { eaten: eatenKcal, target } : null;
  const protein = proteinTarget ? { eaten: eatenProtein, target: proteinTarget } : null;
  const fitness = { done: workout.done + tasks.moves.done, total: workout.total + tasks.moves.total };
  const allTasks = { done: tasks.moves.done + tasks.other.done, total: tasks.moves.total + tasks.other.total };
  const day = dailyScore({ calorie: calorieScore(eatenKcal, target, true), protein, fitness, tasks: tasks.other });
  const message = dayMessage({ minutes, kcal, protein, workout, tasks: allTasks, activeMinutes, score: day.score });
  return { kcal, protein, allTasks, day, message };
}

/**
 * The top of the day: the daily score with its four parts and one line on what matters now,
 * then three cards (calories, protein, tasks), each a tap away from its full view.
 */
export function DaySummary({
  target,
  proteinTarget,
  minutes,
  trackHref = "/progress?r=day",
  history,
  persist = false,
}: {
  /** Daily calorie target, or null when calories are not counted. */
  target: number | null;
  proteinTarget: number | null;
  /** Minutes since local midnight on the server, until the client knows. */
  minutes: number;
  /** Where the calorie and protein cards lead (null: not links, as in the demo). */
  trackHref?: string | null;
  /** Earlier scores to compare with (saved on their own days). */
  history?: { yesterday: number | null; weekAvg: number | null };
  /** Save today's score as it changes (off in the demo). */
  persist?: boolean;
}) {
  const now = useMinutes(minutes);
  const { kcal, protein, allTasks, day, message } = useSummary(target, proteinTarget, now);
  const last = useRef("");
  useEffect(() => {
    if (!persist || day.score === null) return;
    const snap = { score: day.score, points: day.points, kcalTarget: target, proteinTarget };
    const key = JSON.stringify(snap);
    if (key === last.current) return;
    const id = setTimeout(() => {
      last.current = key;
      saveDayScore(snap).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [persist, day.score, day.points, target, proteinTarget]);
  return (
    <>
      <ScoreCard score={day.score} points={day.points} message={message.text} tone={message.tone} history={history} evening={now >= 20 * 60} />
      <div className="grid grid-cols-3 gap-2.5">
        <MetricCard
          href={trackHref}
          icon={<Flame aria-hidden="true" className="size-4" />}
          title="קלוריות"
          value={kcal ? fmt(kcal.eaten) : "–"}
          of={kcal ? fmt(kcal.target) : null}
          share={kcal ? kcal.eaten / kcal.target : 0}
          tone={!kcal ? "idle" : kcal.eaten > kcal.target * 1.1 ? "over" : kcal.eaten >= kcal.target * 0.9 ? "done" : "going"}
          note={!kcal ? "בלי ספירה" : kcal.eaten <= kcal.target ? `נותרו ${fmt(kcal.target - kcal.eaten)}` : `מעל ב-${fmt(kcal.eaten - kcal.target)}`}
        />
        <MetricCard
          href={trackHref}
          icon={<Beef aria-hidden="true" className="size-4" />}
          title="חלבון (ג׳)"
          value={protein ? fmt(protein.eaten) : "–"}
          of={protein ? fmt(protein.target) : null}
          share={protein ? protein.eaten / protein.target : 0}
          tone={!protein ? "idle" : protein.eaten >= protein.target ? "done" : "going"}
          note={!protein ? "אין יעד" : protein.eaten >= protein.target ? "הגעת ליעד" : `נותרו ${fmt(protein.target - protein.eaten)} ג׳`}
        />
        <MetricCard
          href="#tasks"
          icon={<ListChecks aria-hidden="true" className="size-4" />}
          title="משימות"
          value={String(allTasks.done)}
          of={String(allTasks.total)}
          share={allTasks.total ? allTasks.done / allTasks.total : 0}
          tone={allTasks.total && allTasks.done >= allTasks.total ? "done" : "going"}
          note={allTasks.total ? (allTasks.done >= allTasks.total ? "הכול הושלם" : "הושלמו") : "אין היום"}
        />
      </div>
    </>
  );
}

const RING = { r: 34, c: 2 * Math.PI * 34 };

function ScoreCard({
  score,
  points,
  message,
  tone,
  history,
  evening,
}: {
  score: number | null;
  points: Record<DailyPart, number | null>;
  message: string;
  tone: "good" | "info" | "warn";
  history?: { yesterday: number | null; weekAvg: number | null };
  evening: boolean;
}) {
  const diff = score !== null && history?.yesterday != null ? score - history.yesterday : null;
  const color = score === null ? "text-white/20" : score >= 70 ? "text-accent" : score >= 40 ? "text-sky" : "text-coral";
  return (
    <section aria-label="הציון היומי" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-night p-4 text-white shadow-[var(--shadow-float)]">
      <div className="flex items-center gap-4">
        <div className="relative flex size-[84px] shrink-0 items-center justify-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={RING.r} fill="none" stroke="currentColor" strokeWidth="7" className="text-white/10" />
            <circle
              cx="40"
              cy="40"
              r={RING.r}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING.c}
              strokeDashoffset={RING.c * (1 - (score ?? 0) / 100)}
              className={`${color} transition-[stroke-dashoffset] duration-700`}
            />
          </svg>
          <span className="flex flex-col items-center leading-none">
            <span className="num text-[28px] font-bold">{score ?? "–"}</span>
            <span className="mt-0.5 text-[10px] text-white/55">מתוך 100</span>
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="text-sm font-medium text-white/70">{evening ? "סיכום היום" : "הציון היומי"}</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {(Object.keys(DAILY_WEIGHTS) as DailyPart[]).map((k) => (
              <div key={k} className="flex items-baseline justify-between gap-1 text-sm">
                <dt className="text-white/65">{PART_LABEL[k]}</dt>
                <dd className="num font-medium">
                  {points[k] ?? "–"}
                  <span className="text-xs text-white/45">/{DAILY_WEIGHTS[k]}</span>
                </dd>
              </div>
            ))}
          </dl>
          {history && (history.yesterday !== null || history.weekAvg !== null) ? (
            <p className="text-xs text-white/55">
              {history.yesterday !== null ? (
                <>
                  אתמול <span className="num text-white/80">{history.yesterday}</span>
                  {diff !== null && evening && diff !== 0 ? <span className={diff > 0 ? "text-accent" : "text-coral"}> ({diff > 0 ? "+" : "−"}{Math.abs(diff)})</span> : null}
                </>
              ) : null}
              {history.yesterday !== null && history.weekAvg !== null ? " · " : null}
              {history.weekAvg !== null ? (
                <>
                  ממוצע שבועי <span className="num text-white/80">{history.weekAvg}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      <p
        role="status"
        className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm leading-snug ${tone === "good" ? "bg-accent text-ink" : tone === "warn" ? "bg-coral/20 text-white" : "bg-white/[0.07] text-white"}`}
      >
        <Sparkles aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone === "good" ? "" : "text-accent"}`} />
        {message}
      </p>
    </section>
  );
}

type MetricTone = "going" | "done" | "over" | "idle";
const BAR: Record<MetricTone, string> = { going: "bg-sky", done: "bg-accent-strong", over: "bg-coral", idle: "bg-line" };

function MetricCard({
  href,
  icon,
  title,
  value,
  of,
  share,
  tone,
  note,
}: {
  href: string | null;
  icon: React.ReactNode;
  title: string;
  value: string;
  of: string | null;
  share: number;
  tone: MetricTone;
  note: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-1 text-xs font-medium text-ink-muted">
        <span className="flex items-center gap-1">
          {icon}
          {title}
        </span>
        {href ? <ChevronLeft aria-hidden="true" className="size-3.5 opacity-60" /> : null}
      </span>
      <span className="flex flex-col gap-0.5 leading-none">
        <span className="num text-2xl font-bold">{value}</span>
        <span className="truncate text-[11px] text-ink-muted">{of ? <>מתוך <span className="num">{of}</span></> : "\u00a0"}</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-field" role="progressbar" aria-label={title} aria-valuenow={Math.round(Math.min(1, share) * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span className={`block h-full rounded-full transition-[width] duration-500 ${BAR[tone]}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
      </span>
      <span className={`truncate text-xs ${tone === "over" ? "text-coral" : tone === "done" ? "font-medium text-accent-strong" : "text-ink-muted"}`}>{note}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]";
  return href ? (
    <Link href={href} className={`${cls} transition-shadow hover:shadow-[var(--shadow-float)]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
