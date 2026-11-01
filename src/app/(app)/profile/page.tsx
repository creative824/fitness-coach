import type { Metadata } from "next";
import { LogOut, Pencil, Trophy } from "lucide-react";
import { Suspense } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";
import { signOut } from "@/lib/auth/actions";
import { getProfileSummary } from "@/lib/data/profile";
import { requireUser } from "@/lib/data/user";
import { CalorieToggle } from "@/components/food/calorie-toggle";
import { TelegramCard } from "@/components/telegram/telegram-card";
import { createClient } from "@/lib/supabase/server";
import { prizeTotal } from "@/lib/competitions/data";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.profile;

export const metadata: Metadata = { title: s.title };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title={s.title} />
      <Suspense fallback={<LoadingState label={t.common.loading} />}>
        <ProfileContent />
      </Suspense>
      <p className="px-2 text-sm text-ink-muted">{s.privacy}</p>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser();
  const supabase = await createClient();
  const [profile, { data: prefs, error: prefsError }, { data: tgLink, error: tgError }, prizes] = await Promise.all([
    getProfileSummary(user.id),
    supabase.from("profiles").select("calorie_tracking").eq("user_id", user.id).maybeSingle(),
    supabase.from("telegram_links").select("linked_at").eq("user_id", user.id).maybeSingle(),
    prizeTotal(user.id),
  ]);
  return (
    <>
      <Card tone="night" className="relative flex flex-col gap-5 overflow-hidden p-6">
        <div className="relative flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-ink"
          >
            {profile?.display_name?.trim().charAt(0) ?? "?"}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-xl font-semibold">{profile?.display_name ?? "—"}</span>
            {!profile?.onboarding_completed_at ? (
              <span className="w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-sm text-accent">{s.notCompleted}</span>
            ) : null}
          </div>
        </div>
        {prizes > 0 ? (
          <span className="relative flex items-center gap-2 text-sm text-white/80">
            <Trophy aria-hidden="true" className="size-4 text-accent" />
            <span className="num">{prizes}</span> נקודות מתחרויות
          </span>
        ) : null}
        <ButtonLink href="/onboarding" variant="accent" className="relative">
          <Pencil aria-hidden="true" className="size-4" />
          {s.editProfile}
        </ButtonLink>
      </Card>
      {prefsError ? null : (
        <Card>
          <CalorieToggle on={(prefs as { calorie_tracking?: boolean } | null)?.calorie_tracking !== false} />
        </Card>
      )}
      {tgError ? null : (
        <Card>
          <TelegramCard linked={Boolean(tgLink)} linkedAt={(tgLink as { linked_at?: string } | null)?.linked_at ?? null} />
        </Card>
      )}
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{s.account}</h2>
        <span dir="ltr" className="rounded-xl bg-field px-4 py-3 text-end text-ink-muted">
          {user.email}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full">
            <LogOut aria-hidden="true" className="size-4" />
            {t.auth.signOut}
          </Button>
        </form>
      </Card>
    </>
  );
}
