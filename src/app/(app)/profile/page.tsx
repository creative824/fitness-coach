import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.profile;

export const metadata: Metadata = { title: s.title };

/** Empty shell. Profile editing arrives in phase 1, data export/delete in phase 7. */
export default function ProfilePage() {
  return (
    <>
      <PageHeader title={s.title} />
      <EmptyState icon={<UserRound aria-hidden="true" className="size-6" />} title={t.common.comingSoon} body={s.emptyBody} />
      <Card className="text-sm text-ink-muted">{s.privacy}</Card>
    </>
  );
}
