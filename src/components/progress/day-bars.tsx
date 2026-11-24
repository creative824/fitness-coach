/**
 * One number per day as rounded bars against a dashed target line: calories or protein over a
 * week or a month. Big, few labels, colour says how the day went.
 */
export interface BarDay {
  date: string;
  value: number | null;
}

const LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

export type BarKind = "calories" | "protein";

function fill(kind: BarKind, v: number, target: number | null): string {
  if (!target) return "bg-sky";
  if (kind === "protein") return v >= target ? "bg-accent-strong" : "bg-sky";
  if (v > target * 1.1) return "bg-coral";
  if (v < target * 0.8) return "bg-sky";
  return "bg-accent-strong";
}

export function DayBars({ days, target, today, kind, label }: { days: BarDay[]; target: number | null; today: string; kind: BarKind; label: string }) {
  const max = Math.max(target ?? 0, ...days.map((d) => d.value ?? 0)) * 1.12 || 1;
  const month = days.length > 7;
  return (
    <figure className="flex flex-col gap-1.5" aria-label={label}>
      <div className={`relative flex h-36 items-end border-b border-line ${month ? "gap-[3px]" : "gap-2"}`}>
        {target ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/30" style={{ bottom: `${(target / max) * 100}%` }}>
            <span className="num absolute -top-4 end-0 text-[10px] text-ink-muted">
              יעד {target.toLocaleString("he-IL")}
            </span>
          </div>
        ) : null}
        {days.map((d) => (
          <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            {!month && d.value ? <span className="num text-[10px] text-ink-muted">{d.value.toLocaleString("he-IL")}</span> : null}
            <div
              title={d.value ? `${d.date.slice(8)}/${d.date.slice(5, 7)}: ${d.value}` : undefined}
              className={`w-full ${month ? "" : "max-w-8"} rounded-t-md transition-[height] duration-500 ${d.value ? fill(kind, d.value, target) : "bg-field"} ${d.date === today ? "outline-2 outline-offset-1 outline-ink/40" : ""} ${d.date > today ? "opacity-40" : ""}`}
              style={{ height: d.value ? `${Math.max(4, (d.value / max) * 100)}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className={`flex ${month ? "gap-[3px]" : "gap-2"}`}>
        {days.map((d) => {
          const n = Number(d.date.slice(8));
          return (
            <span key={d.date} className={`min-w-0 flex-1 text-center text-[11px] ${d.date === today ? "font-semibold text-ink" : "text-ink-muted"}`}>
              {month ? (n === 1 || n % 7 === 1 ? n : "") : LETTERS[weekday(d.date)]}
            </span>
          );
        })}
      </div>
    </figure>
  );
}
