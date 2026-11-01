import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crown, Medal, Users } from "lucide-react";
import { Suspense } from "react";
import { BackLink } from "@/components/competitions/create-form";
import { LeaveButton, OwnerPanel } from "@/components/competitions/manage";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { loadCompetition, type CompetitionView } from "@/lib/competitions/data";
import { KIND_INFO, PRIZES, SHARED_RULES, STATUS_LABEL, timeLeftLabel } from "@/lib/competitions/rules";
import { requireUser } from "@/lib/data/user";
import { localDay } from "@/lib/water/time";

export const metadata: Metadata = { title: "טבלת מנצחים" };

export default function CompetitionPage({ params }: PageProps<"/competitions/[id]">) {
  return (
    <>
      <BackLink />
      <Suspense fallback={<LoadingState label="טוען…" />}>
        <CompetitionContent params={params} />
      </Suspense>
    </>
  );
}

async function CompetitionContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const view = await loadCompetition(user.id, id);
  if (!view) notFound();
  const { competition: c, standings } = view;
  const today = localDay(new Date()).date;
  const info = KIND_INFO[c.kind];
  const left = timeLeftLabel(c, c.status, today);
  const open = c.status === "active" || c.status === "upcoming";

  return (
    <>
      <Card tone="night" className="flex flex-col gap-3 p-6">
        <span className="w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-sm text-accent">{STATUS_LABEL[c.status]}</span>
        <h1 className="text-[1.75rem] leading-tight font-semibold">{c.name}</h1>
        <p className="text-white/70">{info.title}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
          <span className="flex items-center gap-1.5">
            <Users aria-hidden="true" className="size-4" />
            {standings.length}/{c.max_members}
          </span>
          <span>
            {fmt(c.start_date)} – {fmt(c.end_date)}
          </span>
          {left ? <span className="text-accent">{left}</span> : null}
        </div>
      </Card>

      {view.results.length ? <Results results={view.results} /> : null}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{view.results.length ? "הטבלה בסיום" : "הטבלה עכשיו"}</h2>
        {c.status === "upcoming" ? <p className="text-sm text-ink-muted">הניקוד יתחיל ביום הראשון של התחרות.</p> : null}
        <ol className="flex flex-col gap-2">
          {standings.map((s) => (
            <li
              key={s.member_key}
              className={`flex flex-col gap-2 rounded-xl px-4 py-3 ${s.is_me ? "bg-accent-soft ring-1 ring-accent" : "bg-field"}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-semibold tabular-nums">{s.rank ?? "–"}</span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate font-medium">
                  {s.display_name}
                  {s.is_owner ? <Crown aria-label="יוצר התחרות" className="size-3.5 shrink-0 text-ink-muted" /> : null}
                  {s.is_me ? <span className="text-xs text-ink-muted">(את/ה)</span> : null}
                </span>
                <span className="font-semibold tabular-nums">{s.score === null ? "–" : `${s.score}%`}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white" aria-hidden="true">
                <div className="h-full rounded-full bg-night" style={{ width: `${s.score ?? 0}%` }} />
              </div>
              {s.is_me && s.score !== null ? (
                <span className="text-xs text-ink-muted">
                  הושלמו {s.done} מתוך {Math.max(s.planned, 0)} בתוכנית שלך
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>

      <Card tone="glass" className="flex flex-col gap-3">
        <h2 className="font-semibold">איך מחשבים</h2>
        <p className="text-sm leading-relaxed">{info.formula}</p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink-muted">
          {SHARED_RULES.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      </Card>

      {c.isOwner ? (
        <OwnerPanel
          id={c.id}
          open={open}
          members={open ? standings.filter((s) => !s.is_me).map((s) => ({ key: s.member_key, name: s.display_name })) : []}
        />
      ) : open ? (
        <LeaveButton id={c.id} />
      ) : null}
    </>
  );
}

function Results({ results }: { results: CompetitionView["results"] }) {
  const winners = results.filter((r) => r.prize_points > 0);
  return (
    <Card tone="lime" className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Medal aria-hidden="true" className="size-5" />
        המנצחים
      </h2>
      {winners.length ? (
        <ol className="flex flex-col gap-1.5">
          {winners.map((r) => (
            <li key={`${r.rank}-${r.display_name}`} className="flex items-center justify-between gap-3">
              <span className={r.is_me ? "font-semibold" : ""}>
                {r.rank}. {r.display_name}
                {r.is_me ? " (את/ה)" : ""}
              </span>
              <span className="tabular-nums">+{r.prize_points} נקודות</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm">אף אחד לא השלים משימות בתחרות הזו, ולכן לא חולקו פרסים.</p>
      )}
      <p className="text-xs">פרסים: {PRIZES.join(" / ")} נקודות למקומות 1–3.</p>
    </Card>
  );
}

function fmt(date: string) {
  const [, m, d] = date.split("-");
  return `${Number(d)}.${Number(m)}`;
}
