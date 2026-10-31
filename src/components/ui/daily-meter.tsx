/**
 * Daily meter (spec §12): earned points out of possible points, plus tasks done.
 * Pure presentational; numbers come from the server.
 */
export function DailyMeter({
  earned,
  possible,
  tasksDone,
  tasksTotal,
  label,
}: {
  earned: number;
  possible: number;
  tasksDone: number;
  tasksTotal: number;
  label: string;
}) {
  const ratio = possible > 0 ? Math.min(earned / possible, 1) : 0;
  const r = 52;
  const circumference = 2 * Math.PI * r;

  return (
    <figure className="flex items-center gap-5" aria-label={`${label}: ${earned} מתוך ${possible}`}>
      <svg viewBox="0 0 120 120" className="size-28 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-brand-soft)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <figcaption className="flex flex-col gap-1">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="text-3xl font-bold">
          <span className="ltr-nums">
            {earned}/{possible}
          </span>
        </span>
        <span className="text-sm text-ink-muted">
          <span className="ltr-nums">
            {tasksDone}/{tasksTotal}
          </span>{" "}
          משימות הושלמו
        </span>
      </figcaption>
    </figure>
  );
}
