import type { Metadata } from "next";
import { ArrowLeft, ClipboardList, Droplets, Dumbbell, Salad, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DailyMeter } from "@/components/ui/daily-meter";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { WeekStrip } from "@/components/ui/week-strip";
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

const areas = [
  { key: "nutrition", Icon: Salad, tile: "bg-coral-soft", chip: "bg-coral text-white" },
  { key: "workout", Icon: Dumbbell, tile: "bg-sky-soft", chip: "bg-sky text-white" },
  { key: "habits", Icon: Droplets, tile: "bg-lilac-soft", chip: "bg-lilac text-white" },
] as const;

/** Tasks, completion and scoring arrive in phase 3. */
async function Today() {
  const user = await requireUser();
  const profile = await getProfileSummary(user.id);
  const name = profile?.display_name;
  const ready = Boolean(profile?.onboarding_completed_at);

  return (
    <>
      <header className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink ring-4 ring-white"
          >
            {name ? name.trim().charAt(0) : <Sparkles className="size-5" />}
          </span>
          <div className="flex flex-col">
            {name ? <span className="text-sm text-ink-muted">{s.greeting.replace("{name}", name)}</span> : null}
            <h1 className="text-2xl leading-tight font-semibold">{s.title}</h1>
          </div>
        </div>
      </header>

      <WeekStrip label={s.weekLabel} />

      <Card tone="night" className="dot-grid relative overflow-hidden p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-16 size-56 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative">
          <DailyMeter earned={0} possible={0} tasksDone={0} tasksTotal={0} label={s.meterLabel} tone="dark" />
        </div>
      </Card>

      <section aria-labelledby="areas" className="flex flex-col gap-3">
        <h2 id="areas" className="text-lg font-semibold">
          {s.areasTitle}
        </h2>
        <ul className="grid grid-cols-3 gap-3">
          {areas.map(({ key, Icon, tile, chip }) => (
            <li key={key} className={`flex flex-col gap-6 rounded-[var(--radius-tile)] p-4 ${tile}`}>
              <span className={`flex size-10 items-center justify-center rounded-full ${chip}`}>
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{s.areas[key]}</span>
                <span className="text-xs text-ink-muted">{s.areasPending}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {ready ? (
        <EmptyState icon={<Sparkles aria-hidden="true" />} title={s.readyTitle} body={s.readyBody} />
      ) : (
        <EmptyState
          icon={<ClipboardList aria-hidden="true" />}
          title={s.emptyTitle}
          body={s.emptyBody}
          action={
            <ButtonLink href="/onboarding">
              {s.emptyCta}
              <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover/btn:-translate-x-0.5" />
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
