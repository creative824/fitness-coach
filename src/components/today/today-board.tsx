"use client";

import { Check, Droplet, Droplets, Dumbbell, Footprints, Moon, MoreHorizontal, Salad, Sparkles, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { DailyMeter } from "@/components/ui/daily-meter";
import { getDictionary } from "@/lib/i18n/he";
import { setTaskOutcome } from "@/lib/plan/actions";
import type { DayTask, TaskStatus } from "@/lib/plan/data";
import { pointsFor, type TaskType } from "@/lib/plan/tasks";
import { addWaterFill, setWaterVessel, undoWaterFill } from "@/lib/water/actions";
import { dailyWaterTargetMl, VESSEL_SIZES_ML, waterPace } from "@/lib/water/plan";

const t = getDictionary();
const w = t.water;
const s = t.screens.today;

export interface WaterInit {
  vesselMl: number;
  /** Today's fills in the order they were logged (ml each). */
  logs: number[];
  /** Inputs to recompute the target and pace on the client after each tap. */
  weightKg: number | null;
  workoutToday: boolean;
  medicalRestriction: boolean;
  nowMin: number;
}

const ICONS: Record<TaskType, typeof Salad> = {
  meal: Salad,
  workout: Dumbbell,
  movement: Footprints,
  water: Droplets,
  recovery: Moon,
  habit: Sparkles,
};

const CHIP: Record<TaskType, string> = {
  meal: "bg-coral-soft text-coral",
  workout: "bg-sky-soft text-sky",
  movement: "bg-lilac-soft text-lilac",
  water: "bg-sky-soft text-sky",
  recovery: "bg-lilac-soft text-lilac",
  habit: "bg-lilac-soft text-lilac",
};

const isDone = (st: TaskStatus) => st === "done" || st === "partial" || st === "swapped";

function earnedFor(task: DayTask, status: TaskStatus): number {
  return isDone(status) ? pointsFor(task.type, status as "done" | "partial" | "swapped") : 0;
}

/**
 * The today screen's interactive part: daily meter, task list and water card in one client
 * component, so a tap updates everything on the same frame. The server is told in the
 * background; if a write fails the tap is rolled back and a short note is shown.
 */
export function TodayBoard({
  tasks: initialTasks,
  water,
  workoutHref,
}: {
  tasks: DayTask[];
  water: WaterInit | null;
  /** Where the workout's exercises, demonstrations and times are shown. */
  workoutHref?: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>(() =>
    Object.fromEntries(initialTasks.map((x) => [x.id, x.status])),
  );
  const [fills, setFills] = useState<number[]>(water?.logs ?? []);
  const drank = fills.reduce((a, b) => a + b, 0);
  const [vesselMl, setVessel] = useState(water?.vesselMl ?? 250);
  const [menu, setMenu] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  const waterTask = initialTasks.find((x) => x.type === "water") ?? null;
  const target = water
    ? dailyWaterTargetMl({ weightKg: water.weightKg, workoutToday: water.workoutToday, medicalRestriction: water.medicalRestriction })
    : null;
  const pace = water && target !== null ? waterPace(drank, target, vesselMl, water.nowMin) : null;

  const counted = initialTasks.filter((x) => statuses[x.id] !== "skipped");
  const earned = initialTasks.reduce((sum, x) => sum + earnedFor(x, statuses[x.id]), 0);
  const possible = counted.reduce((sum, x) => sum + x.points, 0);
  const done = counted.filter((x) => isDone(statuses[x.id])).length;

  function run(write: () => Promise<{ ok: boolean }>, rollback: () => void) {
    setFailed(false);
    startTransition(async () => {
      const r = await write().catch(() => ({ ok: false }));
      if (!r.ok) {
        rollback();
        setFailed(true);
      }
    });
  }

  function mark(task: DayTask, next: TaskStatus) {
    const prev = statuses[task.id];
    setStatuses((m) => ({ ...m, [task.id]: next }));
    setMenu(null);
    run(
      () => setTaskOutcome(task.id, next),
      () => setStatuses((m) => ({ ...m, [task.id]: prev })),
    );
  }

  function reachedAfter(ml: number): boolean | null {
    if (target === null || !waterTask) return null;
    const before = drank >= target;
    const after = ml >= target;
    return before === after ? null : after; // only tell the server when it changes
  }

  function syncWaterStatus(reached: boolean | null) {
    if (reached === null || !waterTask) return;
    setStatuses((m) => ({ ...m, [waterTask.id]: reached ? "done" : "pending" }));
  }

  function addFill() {
    const size = vesselMl;
    const reached = reachedAfter(drank + size);
    const prevStatuses = statuses;
    setFills((f) => [...f, size]);
    syncWaterStatus(reached);
    run(
      () => addWaterFill(size, waterTask?.id ?? null, reached),
      () => {
        setFills((f) => f.slice(0, -1));
        setStatuses(prevStatuses);
      },
    );
  }

  function undoFill() {
    if (!fills.length) return;
    // The server removes the latest fill, the same one as the end of this list.
    const size = fills[fills.length - 1];
    const reached = reachedAfter(drank - size);
    const prevStatuses = statuses;
    setFills((f) => f.slice(0, -1));
    syncWaterStatus(reached);
    run(
      () => undoWaterFill(waterTask?.id ?? null, reached),
      () => {
        setFills((f) => [...f, size]);
        setStatuses(prevStatuses);
      },
    );
  }

  function pickVessel(ml: number) {
    if (ml === vesselMl) return;
    const prev = vesselMl;
    setVessel(ml);
    run(
      () => setWaterVessel(ml),
      () => setVessel(prev),
    );
  }

  return (
    <>
      <Card tone="night" className="p-6">
        <DailyMeter earned={earned} possible={possible} tasksDone={done} tasksTotal={counted.length} label={s.meterLabel} tone="dark" />
      </Card>

      {failed ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          {s.saveFailed}
        </p>
      ) : null}

      {initialTasks.length ? (
        <section aria-labelledby="tasks" className="flex flex-col gap-3">
          <h2 id="tasks" className="text-lg font-semibold">
            {s.tasksTitle}
          </h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
            {initialTasks.map((task) => {
              const st = statuses[task.id];
              const Icon = ICONS[task.type];
              const auto = task.type === "water" && water !== null;
              const finished = isDone(st);
              return (
                <li key={task.id} className="flex flex-col">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${CHIP[task.type]}`}>
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className={`leading-snug ${st === "skipped" ? "text-ink-muted line-through" : finished ? "text-ink-muted" : "font-medium"}`}>
                        {task.title}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {auto ? s.waterAuto : st === "pending" ? `${task.points} ${s.points}` : s.status[st]}
                        {task.type === "workout" && workoutHref ? (
                          <>
                            {" · "}
                            <Link href={workoutHref} className="font-medium text-ink underline underline-offset-2">
                              תרגילים והדגמות
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </div>
                    {!auto ? (
                      <button
                        type="button"
                        onClick={() => setMenu(menu === task.id ? null : task.id)}
                        aria-expanded={menu === task.id}
                        aria-label={s.moreOptions}
                        className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-field hover:text-ink"
                      >
                        <MoreHorizontal aria-hidden="true" className="size-5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={auto}
                      onClick={() => mark(task, finished || st === "skipped" ? "pending" : "done")}
                      aria-pressed={finished}
                      aria-label={finished ? s.unmark : s.markDone}
                      className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-[background-color,border-color,transform] duration-150 active:scale-95 disabled:cursor-default ${
                        finished ? "border-brand bg-brand text-accent hover:bg-brand-strong" : "border-line text-transparent hover:border-ink/40 hover:text-ink/30"
                      }`}
                    >
                      <Check aria-hidden="true" className="size-5" strokeWidth={3} />
                    </button>
                  </div>
                  {menu === task.id ? (
                    <div className="flex flex-wrap gap-2 px-4 pb-3">
                      {(["partial", "swapped", "skipped"] as const).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => mark(task, o)}
                          className="min-h-10 cursor-pointer rounded-lg border border-line px-3 text-sm transition-colors hover:border-ink/40 hover:bg-field"
                        >
                          {s.outcomes[o]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {water ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{w.title}</h2>
            {pace ? <span className="ltr-nums text-sm text-ink-muted">{w.progress(pace.fillsDone, pace.fillsTotal)}</span> : null}
          </div>

          {pace ? (
            <>
              <ol className="flex flex-wrap gap-1.5" aria-label={w.progress(pace.fillsDone, pace.fillsTotal)}>
                {Array.from({ length: pace.fillsTotal }, (_, i) => (
                  <li key={i}>
                    <Droplet
                      aria-hidden="true"
                      className={`size-7 transition-colors duration-200 ${
                        i < pace.fillsDone ? "fill-brand text-brand" : i < pace.fillsExpected ? "text-warning" : "text-line"
                      }`}
                    />
                  </li>
                ))}
              </ol>
              <p className="text-sm" role="status">
                <span className="font-medium">{w.status[pace.status]}</span>
                {pace.nextAt ? <span className="text-ink-muted"> · {w.nextAt(pace.nextAt)}</span> : null}
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">{w.noTarget}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addFill}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-6 font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-strong active:scale-[0.97]"
            >
              {w.add} · {w.vessels[String(vesselMl) as keyof typeof w.vessels]}
            </button>
            {drank > 0 ? (
              <button
                type="button"
                onClick={undoFill}
                aria-label={w.undo}
                title={w.undo}
                className="flex min-h-12 cursor-pointer items-center rounded-xl px-3 text-ink transition-colors hover:bg-field"
              >
                <Undo2 aria-hidden="true" className="size-5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{w.vesselLabel}</span>
            <div className="flex flex-wrap gap-2">
              {VESSEL_SIZES_ML.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => pickVessel(v)}
                  aria-pressed={v === vesselMl}
                  className={`min-h-10 cursor-pointer rounded-lg border px-3 text-sm transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] ${
                    v === vesselMl ? "border-brand bg-brand-soft font-medium" : "border-line hover:border-ink/40 hover:bg-field"
                  }`}
                >
                  {w.vessels[String(v) as keyof typeof w.vessels]} <span className="ltr-nums text-ink-muted">{v}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-muted">{w.howItWorks}</p>
        </Card>
      ) : null}
    </>
  );
}
