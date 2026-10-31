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
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      {icon ? (
        <div className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-brand">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-sm text-ink-muted">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-[var(--radius-card)] bg-line/60" />
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
    <Card role="alert" className="flex flex-col items-center gap-3 border-danger/30 bg-danger-soft py-10 text-center">
      <h2 className="text-lg font-bold text-danger">{title}</h2>
      <p className="max-w-sm text-ink">{body}</p>
      {action}
    </Card>
  );
}
