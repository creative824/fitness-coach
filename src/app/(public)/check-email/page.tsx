import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { getDictionary } from "@/lib/i18n/he";

const t = getDictionary();

export const metadata: Metadata = { title: t.auth.checkEmailTitle };

export default function CheckEmailPage() {
  return (
    <AuthShell title={t.auth.checkEmailTitle}>
      <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-night text-accent">
        <MailCheck aria-hidden="true" className="size-6" />
      </div>
      <p className="text-ink-muted">{t.auth.checkEmailBody}</p>
    </AuthShell>
  );
}
