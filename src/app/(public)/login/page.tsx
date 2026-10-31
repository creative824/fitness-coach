import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, Field } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.auth.loginTitle };

/** Shell only. Supabase email auth is wired in phase 1. */
export default function LoginPage() {
  return (
    <AuthShell
      title={t.auth.loginTitle}
      footer={
        <Link href="/signup" className="font-medium text-brand underline-offset-4 hover:underline">
          {t.auth.toSignup}
        </Link>
      }
    >
      <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">{t.auth.notReady}</p>
      <form className="flex flex-col gap-4">
        <Field id="email" label={t.auth.email} type="email" autoComplete="email" />
        <Field id="password" label={t.auth.password} type="password" autoComplete="current-password" />
        <Button type="submit" disabled>
          {t.auth.loginCta}
        </Button>
      </form>
      <span className="text-sm text-ink-muted">{t.auth.forgot}</span>
    </AuthShell>
  );
}
