import { ChevronLeft, KeyRound, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { FaceAvatar } from "@/components/ui/face-avatar";
import type { AvatarConfig } from "@/lib/avatar";
import type { CompetitionCard } from "@/lib/competitions/data";
import { KIND_INFO, scoreLabel, timeLeftLabel } from "@/lib/competitions/rules";

/** Competitions the user is in, first thing on the today screen: place, score and time left. */
export function CompetitionsStrip({ items, today, me }: { items: CompetitionCard[]; today: string; me: { seed: string; avatar: AvatarConfig | null } }) {
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
        {items.map((c) => {
          const left = timeLeftLabel(c, c.status, today);
          const lead = c.rank === 1 && c.status === "active";
          return (
            <li key={c.id} className={`shrink-0 snap-start ${items.length === 1 ? "w-full" : "w-[72%] sm:w-60"}`}>
              <Link
                href={`/competitions/${c.id}`}
                className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-3 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] transition-shadow hover:shadow-[var(--shadow-float)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  <span className="shrink-0 text-[11px] text-ink-muted">{left}</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="relative shrink-0">
                    <FaceAvatar seed={me.seed} config={me.avatar} size={40} />
                    {lead ? (
                      <span aria-hidden="true" className="absolute -top-2 -end-1 text-sm">
                        👑
                      </span>
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="text-sm">
                      {c.rank ? (
                        <>
                          מקום <span className="num text-base font-bold">{c.rank}</span>
                          {c.members ? (
                            <span className="text-ink-muted">
                              {" "}
                              מתוך <span className="num">{c.members}</span>
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-ink-muted">
                          <span className="num">{c.members}</span> משתתפים
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-ink-muted">
                      {c.score !== null ? <span className="num font-semibold text-accent-strong">{scoreLabel(c.kind, c.score)}</span> : KIND_INFO[c.kind].title}
                      {c.score !== null ? ` · ${KIND_INFO[c.kind].title}` : ""}
                    </span>
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
