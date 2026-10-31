import Link from "next/link";
import { Dumbbell, LineChart, Salad, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();
const worldIcons = [Salad, Dumbbell, Sparkles, LineChart];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-lg font-bold text-brand">{t.appName}</span>
        <Link href="/login" className="rounded-full px-4 py-2 font-medium text-brand hover:bg-brand-soft">
          {t.auth.loginTitle}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 pb-16">
        {/* Hero */}
        <section className="grid items-center gap-8 pt-6 md:grid-cols-2 md:pt-12">
          <div className="flex flex-col gap-5">
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">{t.landing.heroTitle}</h1>
            <p className="text-lg text-ink-muted">{t.landing.heroBody}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/signup">{t.landing.ctaSignup}</ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                {t.landing.ctaLogin}
              </ButtonLink>
            </div>
          </div>
          <HeroPreview />
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="flex flex-col gap-6">
          <h2 id="how" className="text-2xl font-bold">
            {t.landing.howTitle}
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.landing.steps.map((step, i) => (
              <li key={step.title}>
                <Card className="flex h-full flex-col gap-2">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent font-bold text-brand-strong">
                    {i + 1}
                  </span>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="text-ink-muted">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* Worlds */}
        <section aria-labelledby="worlds" className="flex flex-col gap-6">
          <h2 id="worlds" className="text-2xl font-bold">
            {t.landing.worldsTitle}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {t.landing.worlds.map((world, i) => {
              const Icon = worldIcons[i];
              return (
                <li key={world.title}>
                  <Card className="flex h-full items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-bold">{world.title}</h3>
                      <p className="text-ink-muted">{world.body}</p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="flex flex-col gap-6">
          <h2 id="faq" className="text-2xl font-bold">
            {t.landing.faqTitle}
          </h2>
          <div className="flex flex-col gap-3">
            {t.landing.faq.map((item) => (
              <details key={item.q} className="group rounded-[var(--radius-card)] border border-line bg-surface p-5">
                <summary className="cursor-pointer list-none font-bold marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span aria-hidden="true" className="text-brand transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-ink-muted">
          <p>{t.landing.disclaimer}</p>
          <nav className="flex gap-4">
            <Link href="/privacy" className="underline">
              {t.legal.privacyTitle}
            </Link>
            <Link href="/terms" className="underline">
              {t.legal.termsTitle}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Static illustration of the "Today" screen; not real data. */
function HeroPreview() {
  const tasks = [
    { label: "ארוחת בוקר: יוגורט, שיבולת שועל ופרי", done: true },
    { label: "אימון כוח קצר · 25 דקות", done: true },
    { label: "8 כוסות מים", done: false },
    { label: "הליכה של 20 דקות", done: false },
  ];
  return (
    <Card aria-hidden="true" className="flex flex-col gap-4 md:p-7">
      <div className="flex items-center justify-between">
        <span className="font-bold">היום שלי</span>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-brand-strong">
          <span className="ltr-nums">40/100</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-brand-soft">
        <div className="h-full w-2/5 rounded-full bg-brand" />
      </div>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li
            key={task.label}
            className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm"
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                task.done ? "border-brand bg-brand text-white" : "border-line"
              }`}
            >
              {task.done ? "✓" : ""}
            </span>
            <span className={task.done ? "text-ink-muted line-through" : ""}>{task.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
