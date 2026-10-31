import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, Field } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.auth.signupTitle };

/** Shell only. Supabase email auth + email verification is wired in phase 1. */
export default function SignupPage() {
  return (
    <AuthShell
      title={t.auth.signupTitle}
      footer={
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          {t.auth.toLogin}
        </Link>
      }
    >
      <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">{t.auth.notReady}</p>
      <form className="flex flex-col gap-4">
        <Field id="email" label={t.auth.email} type="email" autoComplete="email" />
        <Field id="password" label={t.auth.password} type="password" autoComplete="new-password" />
        <Button type="submit" disabled>
          {t.auth.signupCta}
        </Button>
      </form>
      <p className="text-sm text-ink-muted">{t.auth.ageNote}</p>
    </AuthShell>
  );
}
