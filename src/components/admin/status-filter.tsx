import Link from "next/link";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/admin/content";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export function StatusFilter({ base, current }: { base: string; current?: ReviewStatus }) {
  const opts: { href: string; label: string; active: boolean }[] = [
    { href: base, label: t.admin.all, active: !current },
    ...REVIEW_STATUSES.map((s) => ({ href: `${base}?status=${s}`, label: t.admin.statuses[s], active: current === s })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.active ? "true" : undefined}
          className={`min-h-10 rounded-full px-4 py-2 text-sm ${o.active ? "bg-ink text-white" : "border border-line bg-surface"}`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

export function parseStatus(v: string | string[] | undefined): ReviewStatus | undefined {
  return typeof v === "string" && (REVIEW_STATUSES as string[]).includes(v) ? (v as ReviewStatus) : undefined;
}
