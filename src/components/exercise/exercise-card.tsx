"use client";

import { Check, ChevronDown, Info, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { MUSCLES } from "@/content/muscles";
import { saveExerciseFeeling } from "@/lib/exercise/actions";
import { ExerciseDemo } from "./exercise-demo";

export interface ExerciseCardData {
  id: string;
  slug: string;
  name: string;
  steps: string[];
  cautions: string | null;
  primary: string[];
  secondary: string[];
  easier: string | null;
}

export interface ExerciseDose {
  sets: number;
  reps?: number;
  seconds?: number;
  rest_seconds: number;
  /** Total seconds of this exercise, rests between sets included. */
  totalSeconds: number;
  perSide: boolean;
}

const muscle = new Map<string, { name_he: string; description_he: string }>(MUSCLES.map((m) => [m.id, m]));
const names = (ids: string[]) => ids.map((id) => muscle.get(id)?.name_he ?? id);

type Feeling = "too_easy" | "too_hard" | null;

/**
 * One exercise of a workout (follow-up spec §5): name, dose and time up front; tapping opens
 * the demonstration, the steps, what to watch out for, the working muscles and an easier
 * option. "Too easy" / "too hard" is saved for the day.
 */
export function ExerciseCard({ ex, dose, date, index }: { ex: ExerciseCardData; dose: ExerciseDose; date: string; index: number }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [feeling, setFeeling] = useState<Feeling>(null);
  const [muscleInfo, setMuscleInfo] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const panel = `ex-${ex.id}-${index}`;

  const doseText = `${dose.sets} סטים × ${dose.reps !== undefined ? `${dose.reps} חזרות` : `${dose.seconds} שניות`}${dose.perSide ? " לכל צד" : ""}`;
  const minutes = Math.max(1, Math.round(dose.totalSeconds / 60));

  function feel(next: Feeling) {
    const prev = feeling;
    const value = next === feeling ? null : next;
    setFeeling(value);
    setFailed(false);
    start(async () => {
      const r = await saveExerciseFeeling(ex.id, date, value ?? "clear").catch(() => ({ ok: false }));
      if (!r.ok) {
        setFeeling(prev);
        setFailed(true);
      }
    });
  }

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panel}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-field/60"
      >
        <span
          className={`num flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? "bg-brand text-accent" : "bg-field text-ink-muted"
          }`}
        >
          {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : index + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`font-medium ${done ? "text-ink-muted" : ""}`}>{ex.name}</span>
          <span className="text-xs text-ink-muted">
            {doseText} · כ-<span className="num">{minutes}</span> דק׳ · {names(ex.primary).join(", ")}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div id={panel} className="flex flex-col gap-4 px-4 pb-4">
          <ExerciseDemo slug={ex.slug} name={ex.name} highlight={ex.primary} />

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-field p-3">
              <dt className="text-xs text-ink-muted">מינון</dt>
              <dd className="font-medium">{doseText}</dd>
            </div>
            <div className="rounded-xl bg-field p-3">
              <dt className="text-xs text-ink-muted">משך</dt>
              <dd className="font-medium">
                כ-<span className="num">{minutes}</span> דק׳, כולל <span className="num">{dose.rest_seconds}</span> שנ׳ מנוחה בין סטים
              </dd>
            </div>
          </dl>

          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">שרירים</h4>
            <div className="flex flex-wrap gap-1.5">
              {ex.primary.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMuscleInfo(muscleInfo === m ? null : m)}
                  aria-expanded={muscleInfo === m}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-coral-soft px-3 text-sm text-ink"
                >
                  {muscle.get(m)?.name_he ?? m}
                  <span className="text-[10px] text-ink-muted">עיקרי</span>
                </button>
              ))}
              {ex.secondary.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMuscleInfo(muscleInfo === m ? null : m)}
                  aria-expanded={muscleInfo === m}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-field px-3 text-sm text-ink-muted"
                >
                  {muscle.get(m)?.name_he ?? m}
                  <span className="text-[10px]">מסייע</span>
                </button>
              ))}
            </div>
            {muscleInfo ? (
              <p className="rounded-xl bg-field px-3 py-2 text-sm" role="status">
                <span className="font-medium">{muscle.get(muscleInfo)?.name_he}:</span> {muscle.get(muscleInfo)?.description_he}
              </p>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">איך עושים</h4>
            <ol className="flex flex-col gap-1.5 text-sm">
              {ex.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num shrink-0 font-semibold text-ink-muted">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {ex.cautions ? (
            <p className="flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">שימו לב: </span>
                {ex.cautions}
              </span>
            </p>
          ) : null}

          {ex.easier ? (
            <p className="flex gap-2 rounded-xl bg-sky-soft px-3 py-2 text-sm">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sky" />
              <span>
                <span className="font-medium">קשה מדי? </span>
                אפשר להחליף ב{ex.easier}.
              </span>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDone((d) => !d);
                if (!done) setOpen(false);
              }}
              aria-pressed={done}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 font-medium transition-colors ${
                done ? "bg-brand-soft text-ink" : "bg-brand text-white hover:bg-brand-strong"
              }`}
            >
              <Check aria-hidden="true" className="size-4" />
              {done ? "בטל סימון" : "סיימתי"}
            </button>
            {(["too_easy", "too_hard"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => feel(f)}
                aria-pressed={feeling === f}
                className={`min-h-11 cursor-pointer rounded-xl border px-4 text-sm transition-colors ${
                  feeling === f ? "border-brand bg-brand-soft font-medium" : "border-line hover:border-ink/40 hover:bg-field"
                }`}
              >
                {f === "too_easy" ? "קל מדי" : "קשה מדי"}
              </button>
            ))}
          </div>
          {feeling ? (
            <p className="text-xs text-ink-muted" role="status">
              {feeling === "too_easy" ? "רשמנו. בפעם הבאה אפשר להוסיף חזרה או סט." : "רשמנו. אפשר לקצר טווח, להוריד חזרות או לעבור לגרסה הקלה."}
            </p>
          ) : null}
          {failed ? (
            <p role="alert" className="text-xs text-warning">
              לא הצלחנו לשמור. נסו שוב.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
