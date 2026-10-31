import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

/** Admin shell. Every page re-checks admin rights on the server (requireAdmin). */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin" className="text-lg font-bold text-brand">
          {t.screens.admin.title}
        </Link>
        <Link href="/today" className="text-sm text-ink-muted underline">
          {t.appName}
        </Link>
      </div>
      <Suspense fallback={<div className="h-11" />}>
        <AdminNav />
      </Suspense>
      {children}
    </div>
  );
}
