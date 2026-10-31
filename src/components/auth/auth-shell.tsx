import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-lg font-bold text-brand">
        {t.appName}
      </Link>
      <Card className="flex w-full max-w-sm flex-col gap-5 md:p-7">
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
      </Card>
      <div className="text-sm">{footer}</div>
    </div>
  );
}

export function Field({ id, label, type, autoComplete }: { id: string; label: string; type: string; autoComplete: string }) {
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
        disabled
        className="min-h-12 rounded-2xl border border-line bg-canvas px-4 text-base disabled:opacity-60"
      />
    </div>
  );
}
