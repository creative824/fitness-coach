import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forms";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.auth.forgotTitle };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title={t.auth.forgotTitle}
      footer={
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          {t.auth.toLogin}
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
