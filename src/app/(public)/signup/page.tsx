import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/forms";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.auth.signupTitle };

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
      <SignupForm />
      <p className="text-sm text-ink-muted">{t.auth.ageNote}</p>
    </AuthShell>
  );
}
