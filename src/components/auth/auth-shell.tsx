import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-lg font-bold text-brand">
        {t.appName}
      </Link>
      <Card className="flex w-full max-w-sm flex-col gap-5 md:p-7">
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
      </Card>
      {footer ? <div className="text-sm">{footer}</div> : null}
    </div>
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
      <label htmlFor={id} className="font-medium">
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
        className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-brand"
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
      className={`rounded-2xl px-4 py-3 text-sm ${kind === "error" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-strong"}`}
    >
      {children}
    </p>
  );
}
