import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { requireUser } from "@/lib/data/user";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.admin;

export const metadata: Metadata = { title: s.title, robots: { index: false } };

export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <Suspense fallback={<LoadingState label={t.common.loading} />}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

/** Admin rights come from app_metadata.role, which only the server (service role) can set. */
async function AdminContent() {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return (
    <>
      <h1 className="text-2xl font-bold">{s.title}</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {s.sections.map((section) => (
          <li key={section}>
            <Card className="flex items-center justify-between">
              <span className="font-bold">{section}</span>
              <span className="text-sm text-ink-muted">{t.common.comingSoon}</span>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
