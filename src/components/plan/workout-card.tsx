import { Clock, Dumbbell, Timer } from "lucide-react";
import Link from "next/link";
import { ExerciseCard } from "@/components/exercise/exercise-card";
import { Card } from "@/components/ui/card";
import { EXERCISES } from "@/content/exercises";
import { blockSeconds, PER_SIDE, toMinutes, warmupSeconds } from "@/lib/plan/duration";
import type { ExerciseInfo } from "@/lib/plan/data";
import type { PlanDay } from "@/lib/plan/schema";

const easierName = new Map(EXERCISES.map((e) => [e.slug, e.name_he]));

/**
 * The workout of a day (follow-up spec §4–§5): the real total time up front, then each exercise
 * with its demonstration. When a longer "full" version exists, it is offered, never shown by
 * default, because it does not fit the time the user has.
 */
export function WorkoutCard({
  workout,
  exercises,
  date,
  dayIndex,
  showFull,
}: {
  workout: NonNullable<PlanDay["workout"]>;
  exercises: Map<string, ExerciseInfo>;
  date: string;
  dayIndex: number;
  showFull: boolean;
}) {
  const full = showFull && workout.full ? workout.full : null;
  const blocks = full?.blocks ?? workout.blocks;
  const minutes = full?.estimated_minutes ?? workout.estimated_minutes;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-soft text-sky">
          <Dumbbell aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <h3 className="font-semibold">{workout.title}</h3>
          <p className="text-sm text-ink-muted">{workout.why}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-ink">
          <Clock aria-hidden="true" className="size-4" />
          אימון <span className="num">{minutes}</span> דקות
        </span>
      </div>

      {workout.warmup_minutes !== undefined ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Timer aria-hidden="true" className="size-4 shrink-0" />
          <span>
            הזמן כולל חימום של <span className="num">{full ? toMinutes(warmupSeconds(31)) : workout.warmup_minutes}</span> דק׳ (הליכה במקום וסיבובי ידיים), מנוחות ומעבר בין תרגילים.
          </span>
        </p>
      ) : null}

      {workout.full && workout.budget_minutes ? (
        full ? (
          <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            זו הגרסה המלאה: <span className="num">{workout.full.estimated_minutes}</span> דקות, יותר מ-
            <span className="num">{workout.budget_minutes}</span> הדקות שבחרת.{" "}
            <Link href={`/plan?d=${dayIndex}`} scroll={false} className="font-medium underline underline-offset-2">
              חזרה לגרסה של {workout.estimated_minutes} דקות
            </Link>
          </p>
        ) : (
          <p className="rounded-xl bg-field px-4 py-3 text-sm">
            האימון המלא דורש <span className="num">{workout.full.estimated_minutes}</span> דקות, ולכן קיצרנו אותו ל-
            <span className="num">{workout.estimated_minutes}</span> כדי שייכנס ב-<span className="num">{workout.budget_minutes}</span> הדקות שבחרת.{" "}
            <Link href={`/plan?d=${dayIndex}&full=1`} scroll={false} className="font-medium underline underline-offset-2">
              יש לי היום יותר זמן, הראו את הגרסה המלאה
            </Link>
          </p>
        )
      ) : null}

      <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
        {blocks.map((b, i) => {
          const ex = exercises.get(b.exercise_id);
          if (!ex) {
            return (
              <li key={`${b.exercise_id}-${i}`} className="px-4 py-3 text-sm text-ink-muted">
                פריט שהוסר מהמאגר
              </li>
            );
          }
          return (
            <ExerciseCard
              key={`${b.exercise_id}-${i}`}
              index={i}
              date={date}
              ex={{
                id: ex.id,
                slug: ex.slug,
                name: ex.name_he,
                steps: ex.instructions_he.split("\n").filter(Boolean),
                cautions: ex.cautions_he,
                primary: ex.primary_muscles,
                secondary: ex.secondary_muscles,
                easier: ex.easier_slug ? (easierName.get(ex.easier_slug) ?? null) : null,
              }}
              dose={{
                sets: b.sets,
                reps: b.reps,
                seconds: b.seconds,
                rest_seconds: b.rest_seconds,
                totalSeconds: blockSeconds(b, ex.slug),
                perSide: PER_SIDE.has(ex.slug),
              }}
            />
          );
        })}
      </ol>
      <p className="text-xs text-ink-muted">לחיצה על תרגיל פותחת הדגמה, הוראות ושרירים פעילים.</p>
    </Card>
  );
}
