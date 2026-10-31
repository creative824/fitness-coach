import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { contentCounts } from "@/lib/admin/content";
import { requireAdmin } from "@/lib/admin/guard";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.screens.admin.title, robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingState label={t.common.loading} />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  await requireAdmin();
  const c = await contentCounts();
  const tiles = [
    { href: "/admin/exercises?status=draft", label: t.admin.nav.exercises, ...c.exercises },
    { href: "/admin/meals?status=draft", label: t.admin.nav.meals, ...c.meals },
  ];
  return (
    <>
      <p className="text-ink-muted">{t.admin.reviewNote}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((x) => (
          <li key={x.href}>
            <Link href={x.href} className="block">
              <Card className="flex flex-col gap-3 hover:border-brand">
                <span className="text-lg font-bold">{x.label}</span>
                <div className="flex gap-6 text-sm">
                  <span>
                    <span className="block text-2xl font-bold text-warning">{x.draft}</span>
                    {t.admin.pendingReview}
                  </span>
                  <span>
                    <span className="block text-2xl font-bold text-brand">{x.approved}</span>
                    {t.admin.approvedCount}
                  </span>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">{t.admin.reviewerNote}</p>
    </>
  );
}
