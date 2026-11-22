/**
 * Calories per day against the daily target. Week: bars with the target as a dashed line.
 * Month: a calendar where each day is coloured by how close it came to the target.
 */
export interface CalorieDay {
  date: string;
  kcal: number | null;
  workout: "done" | "partial" | "planned" | null;
  activeMin: number;
}

const LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const dayNum = (d: string) => Number(d.slice(8));
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

export function tone(kcal: number | null, target: number | null): "none" | "on" | "under" | "over" {
  if (!kcal) return "none";
  if (!target) return "on";
  if (kcal > target * 1.1) return "over";
  if (kcal < target * 0.8) return "under";
  return "on";
}

const FILL = { none: "bg-field text-ink-faint", on: "bg-accent text-ink", under: "bg-accent-soft text-ink", over: "bg-coral text-white" };

export function WeekBars({ days, target, today }: { days: CalorieDay[]; target: number | null; today: string }) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.kcal ?? 0)) * 1.12 || 1;
  return (
    <figure className="flex flex-col gap-2" aria-label="קלוריות לפי יום בשבוע">
      <div className="relative flex h-40 items-end gap-2 border-b border-line">
        {target ? (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink/25" style={{ bottom: `${(target / max) * 100}%` }}>
            <span className="num absolute -top-5 start-0 rounded bg-surface px-1 text-[10px] text-ink-muted">יעד {target}</span>
          </div>
        ) : null}
        {days.map((d) => {
          const t = tone(d.kcal, target);
          return (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              {d.kcal ? <span className="num text-[10px] text-ink-muted">{d.kcal}</span> : null}
              <div
                className={`w-full max-w-9 rounded-t-md ${t === "none" ? "bg-field" : FILL[t].split(" ")[0]} ${d.date === today ? "ring-2 ring-ink/50" : ""}`}
                style={{ height: d.kcal ? `${Math.max(4, (d.kcal / max) * 100)}%` : "3px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {days.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className={`text-xs ${d.date === today ? "font-semibold" : "text-ink-muted"}`}>{LETTERS[weekday(d.date)]}</span>
            <WorkoutDot w={d.workout} />
          </div>
        ))}
      </div>
    </figure>
  );
}

function WorkoutDot({ w }: { w: CalorieDay["workout"] }) {
  const cls = w === "done" ? "bg-ink" : w === "partial" ? "bg-ink/40" : w === "planned" ? "ring-1 ring-ink/30" : "";
  return <span className={`size-2 rounded-full ${cls}`} aria-label={w === "done" ? "אימון הושלם" : w === "partial" ? "אימון חלקי" : w === "planned" ? "אימון לא בוצע" : undefined} />;
}

export function MonthGrid({ days, target, today }: { days: CalorieDay[]; target: number | null; today: string }) {
  const lead = days.length ? weekday(days[0].date) : 0;
  return (
    <figure className="flex flex-col gap-2" aria-label="קלוריות לפי יום בחודש">
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {LETTERS.map((l) => (
          <span key={l} className="text-[11px] text-ink-muted">
            {l}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {days.map((d) => {
          const t = tone(d.kcal, target);
          const future = d.date > today;
          return (
            <div
              key={d.date}
              title={d.kcal ? `${d.kcal} קל׳` : undefined}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg leading-none ${future ? "bg-transparent text-ink-faint ring-1 ring-line" : FILL[t]} ${d.date === today ? "ring-2 ring-ink" : ""}`}
            >
              <span className="num text-xs font-semibold">{dayNum(d.date)}</span>
              {d.kcal ? <span className="num mt-0.5 mb-1 text-[9px] opacity-80">{d.kcal}</span> : null}
              {d.workout === "done" || d.workout === "partial" ? <span className="absolute inset-x-[30%] bottom-0.5 h-[3px] rounded-full bg-ink/70" aria-label="אימון" /> : null}
            </div>
          );
        })}
      </div>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        <Legend cls="bg-accent" label="ביעד" />
        <Legend cls="bg-accent-soft ring-1 ring-line" label="מתחת ליעד" />
        <Legend cls="bg-coral" label="מעל היעד" />
        <Legend cls="bg-field ring-1 ring-line" label="לא נרשם" />
        <span className="flex items-center gap-1">
          <span className="h-[3px] w-3 rounded-full bg-ink/70" /> אימון
        </span>
      </figcaption>
    </figure>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-3 rounded ${cls}`} />
      {label}
    </span>
  );
}
