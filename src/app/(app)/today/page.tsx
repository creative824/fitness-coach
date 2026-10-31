import type { Metadata } from "next";
import { ClipboardList, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DailyMeter } from "@/components/ui/daily-meter";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { requireUser } from "@/lib/data/user";
import { getDictionary } from "@/lib/i18n/he";
import { getProfileSummary } from "@/lib/data/profile";

const t = getDictionary();
const s = t.screens.today;

export const metadata: Metadata = { title: s.title };

export default function TodayPage() {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <Today />
    </Suspense>
  );
}

/** Tasks, completion and scoring arrive in phase 3. */
async function Today() {
  const user = await requireUser();
  const profile = await getProfileSummary(user.id);
  const name = profile?.display_name;
  return (
    <>
      <PageHeader title={s.title} subtitle={name ? s.greeting.replace("{name}", name) : undefined} />
      <Card>
        <DailyMeter earned={0} possible={0} tasksDone={0} tasksTotal={0} label={s.meterLabel} />
      </Card>
      {profile?.onboarding_completed_at ? (
        <EmptyState icon={<Sparkles aria-hidden="true" className="size-6" />} title={s.readyTitle} body={s.readyBody} />
      ) : (
        <EmptyState
          icon={<ClipboardList aria-hidden="true" className="size-6" />}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={<ButtonLink href="/onboarding">{s.emptyCta}</ButtonLink>}
        />
      )}
    </>
  );
}
