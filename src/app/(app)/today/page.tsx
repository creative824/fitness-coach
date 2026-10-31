import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DailyMeter } from "@/components/ui/daily-meter";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.today;

export const metadata: Metadata = { title: s.title };

/** Empty shell. Tasks, completion and scoring arrive in phase 3. */
export default function TodayPage() {
  return (
    <>
      <PageHeader title={s.title} />
      <Card>
        <DailyMeter earned={0} possible={0} tasksDone={0} tasksTotal={0} label={s.meterLabel} />
      </Card>
      <EmptyState
        icon={<ClipboardList aria-hidden="true" className="size-6" />}
        title={s.emptyTitle}
        body={s.emptyBody}
        action={<ButtonLink href="/onboarding">{s.emptyCta}</ButtonLink>}
      />
    </>
  );
}
