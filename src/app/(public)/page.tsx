import Link from "next/link";
import { ArrowLeft, Check, Dumbbell, LineChart, Plus, Salad, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

/** Bento tiles for the four worlds: each gets its own surface and span. */
const worldTiles = [
  { Icon: Salad, tile: "bg-coral-soft", chip: "bg-coral text-white", span: "md:col-span-4" },
  { Icon: Dumbbell, tile: "bg-night text-white", chip: "bg-accent text-ink", span: "md:col-span-2", dark: true },
  { Icon: Sparkles, tile: "bg-sky-soft", chip: "bg-sky text-white", span: "md:col-span-2" },
  { Icon: LineChart, tile: "bg-accent", chip: "bg-night text-accent", span: "md:col-span-4" },
];

export default function LandingPage() {
  const [lead, ...rest] = t.landing.heroTitle.split(". ");
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <Logo />
        <Link
          href="/login"
          className="rounded-full bg-white/70 px-5 py-2.5 text-sm font-medium ring-1 ring-white backdrop-blur transition-colors hover:bg-white"
        >
          {t.auth.loginTitle}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-4 pb-16 md:gap-32 md:px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 pt-6 md:grid-cols-[1.1fr_1fr] md:pt-14">
          <div className="animate-rise flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-medium ring-1 ring-white">
              <span aria-hidden="true" className="size-2 rounded-full bg-accent shadow-[0_0_0_3px_rgba(212,245,96,0.35)]" />
              {t.landing.heroEyebrow}
            </span>
            <h1 className="isolate text-[2.6rem] leading-[1.05] font-semibold tracking-tight md:text-[4.25rem]">
              {lead}.{" "}
              <span className="text-ink-muted">{rest.slice(0, -1).join(". ")}.</span>{" "}
              <span className="relative whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[-0.15em] bottom-[0.06em] -z-10 h-[0.42em] rounded-full bg-accent"
                />
                {rest.at(-1)}
              </span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-ink-muted">{t.landing.heroBody}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/signup" className="ps-6 pe-2">
                {t.landing.ctaSignup}
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-ink transition-transform group-hover/btn:-translate-x-0.5">
                  <ArrowLeft aria-hidden="true" className="size-4" />
                </span>
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary">
                {t.landing.ctaLogin}
              </ButtonLink>
            </div>
          </div>
          <HeroPreview />
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="flex flex-col gap-8">
          <SectionTitle id="how">{t.landing.howTitle}</SectionTitle>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.landing.steps.map((step, i) => (
              <li key={step.title}>
                <Card className="flex h-full flex-col gap-10 p-6">
                  <span className="num text-5xl font-bold text-ink/15">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* Worlds: bento */}
        <section aria-labelledby="worlds" className="flex flex-col gap-8">
          <SectionTitle id="worlds">{t.landing.worldsTitle}</SectionTitle>
          <ul className="grid gap-4 md:grid-cols-6">
            {t.landing.worlds.map((world, i) => {
              const { Icon, tile, chip, span, dark } = worldTiles[i];
              return (
                <li
                  key={world.title}
                  className={`relative flex min-h-56 flex-col justify-between gap-8 overflow-hidden rounded-[var(--radius-card)] p-6 md:p-8 ${tile} ${span}`}
                >
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1}
                    className={`pointer-events-none absolute -bottom-8 -left-8 size-44 ${dark ? "text-white/5" : "text-ink/5"}`}
                  />
                  <span className={`relative flex size-12 items-center justify-center rounded-full ${chip}`}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="relative flex max-w-sm flex-col gap-2">
                    <h3 className="text-2xl font-semibold">{world.title}</h3>
                    <p className={dark ? "text-white/70" : "text-ink/70"}>{world.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="grid gap-8 md:grid-cols-[1fr_1.6fr]">
          <SectionTitle id="faq">{t.landing.faqTitle}</SectionTitle>
          <div className="flex flex-col gap-3">
            {t.landing.faq.map((item) => (
              <details
                key={item.q}
                className="group rounded-[var(--radius-tile)] bg-surface p-5 shadow-[var(--shadow-card)] open:pb-6"
              >
                <summary className="cursor-pointer list-none font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-field transition-[transform,background-color] group-open:rotate-45 group-open:bg-accent"
                    >
                      <Plus className="size-4" />
                    </span>
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="dot-grid relative overflow-hidden rounded-[2.25rem] bg-night px-6 py-14 text-center text-white md:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative mx-auto flex max-w-xl flex-col items-center gap-5">
            <h2 className="text-3xl font-semibold md:text-5xl">{t.landing.ctaBandTitle}</h2>
            <p className="text-lg text-white/70">{t.landing.ctaBandBody}</p>
            <ButtonLink href="/signup" variant="accent" className="mt-2 ps-6 pe-2">
              {t.landing.ctaSignup}
              <span className="flex size-9 items-center justify-center rounded-full bg-night text-accent">
                <ArrowLeft aria-hidden="true" className="size-4" />
              </span>
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted md:px-6">
          <p className="max-w-3xl leading-relaxed">{t.landing.disclaimer}</p>
          <nav className="flex gap-5">
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              {t.legal.privacyTitle}
            </Link>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              {t.legal.termsTitle}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-3xl leading-tight font-semibold md:text-4xl">
      {children}
    </h2>
  );
}

/** Static illustration of the "Today" screen inside a phone; not real data. */
function HeroPreview() {
  const tasks = [
    { label: "ארוחת בוקר: יוגורט ושיבולת שועל", meta: "בוקר", done: true },
    { label: "אימון כוח קצר", meta: "25 דק׳", done: true },
    { label: "הליכה של 20 דקות", meta: "ערב", done: false },
  ];
  const ticks = 36;
  const lit = Math.round(ticks * 0.72);
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[22rem] select-none py-6">
      {/* Backdrop: lime disc and orbit rings */}
      <div className="absolute inset-x-0 top-1/2 mx-auto aspect-square w-[118%] -translate-y-1/2 rounded-full border border-ink/5" />
      <div className="absolute inset-x-0 top-1/2 mx-auto aspect-square w-[92%] -translate-y-1/2 rounded-full bg-accent/70 blur-[2px]" />

      {/* Phone */}
      <div className="relative mx-auto w-[17.5rem] rounded-[2.75rem] bg-night p-2.5 shadow-[0_40px_80px_-30px_rgba(18,21,19,0.6)]">
        <div className="flex flex-col gap-3 overflow-hidden rounded-[2.2rem] bg-canvas p-3.5 pt-4">
          <div className="mx-auto h-5 w-20 rounded-full bg-night" />
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold">ד</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[0.65rem] text-ink-muted">שלום דנה</span>
              <span className="text-sm font-semibold">היום שלי</span>
            </div>
          </div>

          <div className="dot-grid flex items-center justify-between rounded-[1.4rem] bg-night p-4 text-white">
            <div className="flex flex-col gap-1">
              <span className="text-[0.65rem] text-white/60">המד היומי</span>
              <span className="num text-2xl font-bold">
                72<span className="text-sm text-white/50">/100</span>
              </span>
              <span className="mt-1 w-fit rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem]">
                <span className="num">4/6</span> משימות
              </span>
            </div>
            <svg viewBox="0 0 120 120" className="size-24">
              {Array.from({ length: ticks }, (_, i) => {
                const a = (-135 + (270 / (ticks - 1)) * i) * (Math.PI / 180);
                return (
                  <line
                    key={i}
                    x1={60 + Math.sin(a) * 42}
                    y1={60 - Math.cos(a) * 42}
                    x2={60 + Math.sin(a) * 56}
                    y2={60 - Math.cos(a) * 56}
                    stroke={i < lit ? "var(--color-accent)" : "rgba(255,255,255,0.15)"}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                );
              })}
              <text x="60" y="66" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" className="num">
                72%
              </text>
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ["bg-coral-soft", "bg-coral", Salad],
              ["bg-sky-soft", "bg-sky", Dumbbell],
              ["bg-lilac-soft", "bg-lilac", Sparkles],
            ].map(([tile, chip, Icon], i) => {
              const I = Icon as typeof Salad;
              return (
                <div key={i} className={`flex h-16 flex-col justify-between rounded-2xl p-2 ${tile as string}`}>
                  <span className={`flex size-6 items-center justify-center rounded-full text-white ${chip as string}`}>
                    <I className="size-3" />
                  </span>
                  <span className="h-1 w-full overflow-hidden rounded-full bg-white">
                    <span className={`block h-full rounded-full ${chip as string}`} style={{ width: `${[80, 60, 45][i]}%` }} />
                  </span>
                </div>
              );
            })}
          </div>

          <ul className="flex flex-col gap-1.5">
            {tasks.map((task) => (
              <li key={task.label} className="flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-2.5 text-[0.7rem]">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                    task.done ? "bg-night text-accent" : "ring-2 ring-line ring-inset"
                  }`}
                >
                  {task.done ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className={`flex-1 truncate ${task.done ? "text-ink-muted line-through" : "font-medium"}`}>{task.label}</span>
                <span className="text-ink-faint">{task.meta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Floating stat cards */}
      <div className="absolute top-24 -left-3 hidden w-36 sm:flex flex-col gap-2 rounded-[1.25rem] bg-white/90 p-3.5 shadow-[var(--shadow-float)] ring-1 ring-white backdrop-blur md:-left-14">
        <span className="text-[0.7rem] text-ink-muted">מים היום</span>
        <span className="text-sm font-semibold">
          <span className="num text-2xl font-bold">3</span> מתוך <span className="num">6</span> מילויים
        </span>
        <span className="flex gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 3 ? "bg-sky" : "bg-field"}`} />
          ))}
        </span>
      </div>
      <div className="absolute bottom-24 -right-3 hidden items-center sm:flex gap-2.5 rounded-full bg-night py-2 ps-2 pe-4 text-white shadow-[var(--shadow-float)] md:-right-12">
        <span className="flex size-8 items-center justify-center rounded-full bg-accent text-ink">
          <Dumbbell className="size-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[0.65rem] text-white/60">רצף אימונים</span>
          <span className="text-sm font-semibold">
            <span className="num">5</span> ימים
          </span>
        </span>
      </div>
    </div>
  );
}
