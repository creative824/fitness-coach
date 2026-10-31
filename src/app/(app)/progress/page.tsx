import type { Metadata } from "next";
import { LineChart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.progress;

export const metadata: Metadata = { title: s.title };

/** Empty shell. Filled in a later phase (see docs/TECH_PLAN.md). */
export default function Page() {
  return (
    <>
      <PageHeader title={s.title} />
      <EmptyState icon={<LineChart aria-hidden="true" className="size-6" />} title={t.common.comingSoon} body={s.emptyBody} />
    </>
  );
}
