import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { CompetitionActions, NoCompetitions } from "@/components/competitions/empty";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";
import { listCompetitions } from "@/lib/competitions/data";
import { KIND_INFO, STATUS_LABEL, timeLeftLabel } from "@/lib/competitions/rules";
import { requireUser } from "@/lib/data/user";
import { localDay } from "@/lib/water/time";

export const metadata: Metadata = { title: "תחרויות" };

export default function CompetitionsPage() {
  return (
    <>
      <PageHeader title="תחרויות" subtitle="טבלאות מנצחים פרטיות עם חברים, על התמדה ולא על מספרים בגוף." />
      <Suspense fallback={<LoadingState label="טוען…" />}>
        <CompetitionsList />
      </Suspense>
    </>
  );
}

async function CompetitionsList() {
  const user = await requireUser();
  const list = await listCompetitions(user.id);
  const today = localDay(new Date()).date;

  if (!list.length) return <NoCompetitions />;

  return (
    <>
      <CompetitionActions />
      <ul className="flex flex-col gap-3">
        {list.map((c) => {
          const left = timeLeftLabel(c, c.status, today);
          return (
            <li key={c.id}>
              <Link href={`/competitions/${c.id}`} className="block">
                <Card className="flex items-center gap-4 transition-shadow hover:shadow-[var(--shadow-float)]">
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${c.status === "active" ? "bg-accent text-ink" : "bg-field text-ink-muted"}`}
                  >
                    <Trophy aria-hidden="true" className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{c.name}</span>
                    <span className="text-sm text-ink-muted">
                      {KIND_INFO[c.kind].title} · {left ?? STATUS_LABEL[c.status]}
                    </span>
                  </span>
                  <ChevronLeft aria-hidden="true" className="size-5 text-ink-muted" />
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
