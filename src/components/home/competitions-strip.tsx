import { ChevronLeft, KeyRound, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import type { CompetitionCard } from "@/lib/competitions/data";
import { KIND_INFO, timeLeftLabel } from "@/lib/competitions/rules";

/** Competitions the user is in, first thing on the today screen: place, score and time left. */
export function CompetitionsStrip({ items, today }: { items: CompetitionCard[]; today: string }) {
  if (!items.length) {
    return (
      <section aria-label="תחרויות" className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-night text-accent">
          <Trophy aria-hidden="true" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">תחרות עם חברים</span>
          <span className="truncate text-xs text-ink-muted">מי מתמיד יותר בתפריט ובאימונים</span>
        </span>
        <Link href="/competitions/new" className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong">
          <Plus aria-hidden="true" className="size-4" />
          פתיחה
        </Link>
        <Link href="/competitions/join" aria-label="הצטרפות עם קוד" className="flex size-9 items-center justify-center rounded-lg bg-field hover:bg-line/60">
          <KeyRound aria-hidden="true" className="size-4" />
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="comp-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="comp-title" className="text-sm font-semibold">
          התחרויות שלי
        </h2>
        <Link href="/competitions" className="flex items-center text-xs text-ink-muted hover:text-ink">
          הכול
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {items.map((c, i) => {
          const left = timeLeftLabel(c, c.status, today);
          const lead = c.rank === 1 && c.status === "active";
          return (
            <li key={c.id} className={`shrink-0 snap-start ${items.length === 1 ? "w-full" : "w-[78%] sm:w-64"}`}>
              <Link
                href={`/competitions/${c.id}`}
                className={`flex h-full items-center gap-3 rounded-[var(--radius-card)] p-3 transition-shadow hover:shadow-[var(--shadow-float)] ${
                  i === 0 ? "bg-accent text-ink" : "bg-surface shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]"
                }`}
              >
                <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${i === 0 ? "bg-night text-accent" : "bg-field"}`}>
                  {c.rank ? (
                    <>
                      <span className="num text-xl font-bold">{c.rank}</span>
                      <span className="text-[10px] opacity-70">מקום</span>
                    </>
                  ) : (
                    <Trophy aria-hidden="true" className="size-5" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {c.name} {lead ? "👑" : ""}
                  </span>
                  <span className="truncate text-xs opacity-75">
                    {KIND_INFO[c.kind].title}
                    {c.members ? (
                      <>
                        {" · "}
                        <span className="num">{c.members}</span> משתתפים
                      </>
                    ) : null}
                  </span>
                  <span className="text-xs opacity-75">
                    {c.score !== null ? (
                      <>
                        <span className="num font-semibold">{c.score}%</span>
                        {" · "}
                      </>
                    ) : null}
                    {left}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
