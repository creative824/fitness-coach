import { Button } from "@/components/ui/button";
import { setReviewStatus } from "@/lib/admin/actions";
import type { ReviewStatus } from "@/lib/admin/content";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

/** Server-action buttons: approve / retire / back to draft. */
export function ReviewButtons({ table, id, status }: { table: "exercises" | "recipes"; id: string; status: ReviewStatus }) {
  const to = (next: ReviewStatus) => setReviewStatus.bind(null, table, id, next);
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" ? (
        <form action={to("approved")}>
          <Button type="submit" className="min-h-10 px-4 text-sm">
            {t.admin.approve}
          </Button>
        </form>
      ) : null}
      {status !== "retired" ? (
        <form action={to("retired")}>
          <Button type="submit" variant="secondary" className="min-h-10 px-4 text-sm">
            {t.admin.retire}
          </Button>
        </form>
      ) : null}
      {status !== "draft" ? (
        <form action={to("draft")}>
          <Button type="submit" variant="ghost" className="min-h-10 px-4 text-sm">
            {t.admin.backToDraft}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
