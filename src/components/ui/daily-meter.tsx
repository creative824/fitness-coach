/**
 * Daily meter (spec §12): earned points out of possible points, plus tasks done.
 * Pure presentational; numbers come from the server.
 *
 * Drawn as a 270° tick gauge. `tone="dark"` is for night panels, the default suits white cards.
 */
const TICKS = 44;
const SWEEP = 270;

export function DailyMeter({
  earned,
  possible,
  tasksDone,
  tasksTotal,
  label,
  tone = "light",
}: {
  earned: number;
  possible: number;
  tasksDone: number;
  tasksTotal: number;
  label: string;
  tone?: "light" | "dark";
}) {
  const ratio = possible > 0 ? Math.min(earned / possible, 1) : 0;
  const percent = Math.round(ratio * 100);
  const lit = Math.round(ratio * TICKS);
  const dark = tone === "dark";
  const muted = dark ? "text-white/60" : "text-ink-muted";

  return (
    <figure className="flex items-center justify-between gap-4" aria-label={`${label}: ${earned} מתוך ${possible}`}>
      <figcaption className="flex min-w-0 flex-col gap-4">
        <span className={`text-sm font-medium ${muted}`}>{label}</span>
        <div className="flex flex-col">
          <span className="num text-[2.75rem] leading-none font-bold">
            {earned}
            <span className={`text-2xl font-semibold ${muted}`}>/{possible}</span>
          </span>
          <span className={`mt-1 text-sm ${muted}`}>נקודות היום</span>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
            dark ? "bg-white/10 text-white" : "bg-field text-ink"
          }`}
        >
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          <span className="num font-semibold">
            {tasksDone}/{tasksTotal}
          </span>
          משימות
        </span>
      </figcaption>

      <div className="relative size-36 shrink-0 sm:size-40" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="size-full">
          {Array.from({ length: TICKS }, (_, i) => {
            const angle = (-SWEEP / 2 + (SWEEP / (TICKS - 1)) * i) * (Math.PI / 180);
            const x1 = 60 + Math.sin(angle) * 44;
            const y1 = 60 - Math.cos(angle) * 44;
            const x2 = 60 + Math.sin(angle) * 56;
            const y2 = 60 - Math.cos(angle) * 56;
            const on = i < lit;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth="2.6"
                strokeLinecap="round"
                stroke={on ? "var(--color-accent)" : dark ? "rgba(255,255,255,0.14)" : "var(--color-line)"}
                className="transition-[stroke] duration-500"
                style={{ transitionDelay: `${i * 12}ms` }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-3xl leading-none font-bold">
            {percent}
            <span className="text-lg">%</span>
          </span>
          <span className={`mt-1 text-xs ${muted}`}>הושלם</span>
        </div>
      </div>
    </figure>
  );
}
