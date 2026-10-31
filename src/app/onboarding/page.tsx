import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Questionnaire } from "@/components/onboarding/questionnaire";
import { LoadingState } from "@/components/ui/states";
import { requireUser } from "@/lib/data/user";
import { getDictionary } from "@/lib/i18n/he";
import { loadOnboarding } from "@/lib/onboarding/data";

const t = getDictionary();
const s = t.screens.onboarding;

export const metadata: Metadata = { title: s.title };

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 pt-8">
      <Link href="/" className="text-lg font-bold text-brand">
        {t.appName}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{s.title}</h1>
        <p className="text-ink-muted">{s.body}</p>
      </div>
      <Suspense fallback={<LoadingState label={t.common.loading} />}>
        <OnboardingForm />
      </Suspense>
    </main>
  );
}

async function OnboardingForm() {
  const user = await requireUser();
  const state = await loadOnboarding(user.id);
  return <Questionnaire initial={state.draft} initialStep={state.completedAt ? 0 : state.step} />;
}
