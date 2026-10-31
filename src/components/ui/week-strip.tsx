import { connection } from "next/server";

const TZ = "Asia/Jerusalem";

/** The current Sunday–Saturday week in Israel time, with today highlighted. Server-rendered. */
export async function WeekStrip({ label }: { label: string }) {
  await connection();
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  const todayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const dayName = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "narrow" });
  const dayNum = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric" });
  const fullDate = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + (i - todayIndex) * 86_400_000);
    return { key: i, name: dayName.format(d), num: dayNum.format(d), today: i === todayIndex, full: fullDate.format(d) };
  });

  return (
    <section aria-label={label}>
      <ol className="grid grid-cols-7 gap-1 rounded-2xl bg-surface p-1.5 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
        {days.map((d) => (
          <li key={d.key}>
            <div
              aria-current={d.today ? "date" : undefined}
              aria-label={d.full}
              className={`flex flex-col items-center gap-1 rounded-xl py-2.5 transition-colors ${
                d.today ? "bg-night text-white" : "text-ink-muted"
              }`}
            >
              <span className="text-xs">{d.name}</span>
              <span className={`num text-base font-semibold ${d.today ? "text-white" : "text-ink"}`}>{d.num}</span>
              <span className={`size-1.5 rounded-full ${d.today ? "bg-accent" : "bg-transparent"}`} aria-hidden="true" />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
