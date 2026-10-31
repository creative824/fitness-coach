import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.coach;

export const metadata: Metadata = { title: s.title };

/** Empty shell. The AI coach chat arrives in phase 6. */
export default function CoachPage() {
  return (
    <>
      <PageHeader title={s.title} subtitle={s.disclaimer} />
      <EmptyState icon={<MessageCircle aria-hidden="true" className="size-6" />} title={t.common.comingSoon} body={s.emptyBody} />
    </>
  );
}
