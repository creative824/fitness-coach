import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4 pt-2">
      <div className="flex flex-col gap-1.5">
        {eyebrow ? <span className="text-sm font-medium text-ink-muted">{eyebrow}</span> : null}
        <h1 className="text-[1.75rem] leading-tight font-semibold md:text-4xl">{title}</h1>
        {subtitle ? <p className="text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
