import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/forms";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.auth.resetTitle };

/** Reached from the password-reset email after /auth/confirm has created a session. */
export default function ResetPasswordPage() {
  return (
    <AuthShell title={t.auth.resetTitle}>
      <ResetForm />
    </AuthShell>
  );
}
