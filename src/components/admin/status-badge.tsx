import type { ReviewStatus } from "@/lib/admin/content";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const tone: Record<ReviewStatus, string> = {
  draft: "bg-warning-soft text-warning",
  approved: "bg-brand-soft text-brand-strong",
  retired: "bg-line text-ink-muted",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone[status]}`}>{t.admin.statuses[status]}</span>;
}
