import type { ReactNode } from "react";
import { Card } from "./card";

/** Shared empty / loading / error states (spec §14: every screen defines them). */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="relative flex flex-col items-center gap-3 overflow-hidden px-6 py-10 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent/35 blur-3xl"
      />
      {icon ? (
        <div className="relative mb-1 flex size-16 items-center justify-center rounded-[1.25rem] bg-night text-accent shadow-[var(--shadow-float)] [&_svg]:size-7">
          {icon}
        </div>
      ) : null}
      <h2 className="relative text-xl font-semibold">{title}</h2>
      <p className="relative max-w-sm leading-relaxed text-ink-muted">{body}</p>
      {action ? <div className="relative mt-3">{action}</div> : null}
    </Card>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <div className="h-44 animate-pulse rounded-[var(--radius-card)] bg-night/10" />
      {[0, 1].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-[var(--radius-card)] bg-white/70" />
      ))}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card role="alert" className="flex flex-col items-center gap-3 py-10 text-center ring-1 ring-danger/20">
      <h2 className="text-lg font-semibold text-danger">{title}</h2>
      <p className="max-w-sm text-ink">{body}</p>
      {action}
    </Card>
  );
}
