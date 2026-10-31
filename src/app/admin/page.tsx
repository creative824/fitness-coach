import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.admin;

export const metadata: Metadata = { title: s.title, robots: { index: false } };

/** Shell. Server-side admin guard and real tools arrive with Supabase (phase 1+). */
export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{s.title}</h1>
      <p className="text-ink-muted">{s.body}</p>
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
    </main>
  );
}
