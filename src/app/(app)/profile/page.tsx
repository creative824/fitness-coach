import type { Metadata } from "next";
import { LogOut, Pencil } from "lucide-react";
import { Suspense } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";
import { signOut } from "@/lib/auth/actions";
import { getProfileSummary } from "@/lib/data/profile";
import { requireUser } from "@/lib/data/user";
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
      <Card className="text-sm text-ink-muted">{s.privacy}</Card>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser();
  const profile = await getProfileSummary(user.id);
  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold">{profile?.display_name ?? "—"}</span>
          {!profile?.onboarding_completed_at ? <span className="text-sm text-warning">{s.notCompleted}</span> : null}
        </div>
        <ButtonLink href="/onboarding" variant="secondary">
          <Pencil aria-hidden="true" className="size-4" />
          {s.editProfile}
        </ButtonLink>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-bold">{s.account}</h2>
        <span dir="ltr" className="self-end text-ink-muted">
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
