import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { DailyMeter } from "@/components/ui/daily-meter";
import { Logo } from "@/components/ui/logo";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh md:p-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
        <Logo />
        <Card className="flex w-full max-w-sm flex-col gap-6 p-6 md:p-8">
          <h1 className="text-[1.75rem] leading-tight font-semibold">{title}</h1>
          {children}
        </Card>
        {footer ? <div className="text-sm">{footer}</div> : null}
      </div>
      <AuthAside />
    </div>
  );
}

/** Desktop-only brand panel: a still life of the product's daily gauge. Decorative. */
function AuthAside() {
  return (
    <aside
      aria-hidden="true"
      className="dot-grid relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden rounded-[2.25rem] bg-night p-10 text-white lg:flex"
    >
      <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-accent/25 blur-3xl" />
      <span className="relative"><Logo tone="dark" /></span>
      <div className="relative flex flex-col gap-8">
        <div className="w-full max-w-xs rounded-[var(--radius-card)] bg-night-soft p-6 ring-1 ring-night-line">
          <DailyMeter earned={60} possible={100} tasksDone={3} tasksTotal={5} label={t.screens.today.meterLabel} tone="dark" />
        </div>
        <p className="max-w-sm text-3xl leading-snug font-semibold">{t.landing.authAside}</p>
      </div>
    </aside>
  );
}

export function Field({
  id,
  label,
  type,
  autoComplete,
  hint,
  defaultValue,
  required = true,
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  hint?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        dir={type === "email" ? "ltr" : undefined}
        required={required}
        minLength={minLength}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="min-h-13 rounded-2xl border border-transparent bg-field px-4 text-base text-ink transition-colors placeholder:text-ink-muted hover:border-line focus:border-ink focus:bg-surface focus:outline-none"
      />
      {hint ? (
        <span id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function FormAlert({ kind, children }: { kind: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm ${kind === "error" ? "bg-danger-soft text-danger" : "bg-accent-soft text-ink"}`}
    >
      {children}
    </p>
  );
}
