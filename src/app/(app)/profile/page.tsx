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
import { AvatarCard } from "@/components/profile/avatar-card";
import { FaceAvatar } from "@/components/ui/face-avatar";
import { avatarFromSeed, parseAvatar } from "@/lib/avatar";
import { TelegramCard } from "@/components/telegram/telegram-card";
import { TasteCard } from "@/components/profile/taste-card";
import { ALLERGENS } from "@/lib/onboarding/schema";
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
  const [profile, { data: prefs, error: prefsError }, { data: tgLink, error: tgError }, prizes, { data: food }] = await Promise.all([
    getProfileSummary(user.id),
    supabase.from("profiles").select("calorie_tracking, preferences").eq("user_id", user.id).maybeSingle(),
    supabase.from("telegram_links").select("linked_at").eq("user_id", user.id).maybeSingle(),
    prizeTotal(user.id),
    supabase.from("food_preferences").select("likes, dislikes, allergies").eq("user_id", user.id).maybeSingle(),
  ]);
  const taste = food as { likes?: string[]; dislikes?: string[]; allergies?: string[] } | null;
  const never = (prefs as { preferences?: { never_eat?: unknown } } | null)?.preferences?.never_eat;
  const avatar = parseAvatar((prefs as { preferences?: { avatar?: unknown } } | null)?.preferences?.avatar);
  return (
    <>
      <Card tone="night" className="relative flex flex-col gap-5 overflow-hidden p-6">
        <div className="relative flex items-center gap-4">
          <FaceAvatar seed={user.id} config={avatar} size={64} />
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
          <AvatarCard initial={avatar ?? avatarFromSeed(user.id)} name={profile?.display_name ?? ""} />
        </Card>
      )}
      {prefsError ? null : (
        <Card>
          <CalorieToggle on={(prefs as { calorie_tracking?: boolean } | null)?.calorie_tracking !== false} />
        </Card>
      )}
      {prefsError ? null : (
        <Card>
          <TasteCard
            initial={{ likes: taste?.likes ?? [], dislikes: taste?.dislikes ?? [], never: Array.isArray(never) ? never.filter((x): x is string => typeof x === "string") : [] }}
            allergies={(taste?.allergies ?? []).filter((a): a is (typeof ALLERGENS)[number] => (ALLERGENS as readonly string[]).includes(a))}
          />
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
