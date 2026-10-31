import { Logo } from "@/components/ui/logo";
import type { ReactNode } from "react";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Logo />
      <h1 className="text-4xl font-semibold">{title}</h1>
      <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">{t.legal.draftNotice}</p>
      <article className="flex flex-col gap-3 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:ps-6">
        {children}
      </article>
    </main>
  );
}
