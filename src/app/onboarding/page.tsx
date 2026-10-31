import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const s = t.screens.onboarding;

export const metadata: Metadata = { title: s.title };

/** Shell showing the six questionnaire steps. The real multi-step form with autosave arrives in phase 1. */
export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8">
      <Link href="/" className="text-lg font-bold text-brand">
        {t.appName}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{s.title}</h1>
        <p className="text-ink-muted">{s.body}</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={s.steps.length}
        aria-valuenow={0}
        aria-label="התקדמות בשאלון"
        className="flex gap-1.5"
      >
        {s.steps.map((step) => (
          <span key={step} className="h-2 flex-1 rounded-full bg-brand-soft" />
        ))}
      </div>
      <ol className="flex flex-col gap-3">
        {s.steps.map((step, i) => (
          <li key={step}>
            <Card className="flex items-center gap-4 py-4">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">
                {i + 1}
              </span>
              <span className="font-medium">{step}</span>
              <span className="ms-auto text-sm text-ink-muted">{t.common.comingSoon}</span>
            </Card>
          </li>
        ))}
      </ol>
    </main>
  );
}
