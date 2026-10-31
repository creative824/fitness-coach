import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/forms";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.auth.loginTitle };

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
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
