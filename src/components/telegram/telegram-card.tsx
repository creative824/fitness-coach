"use client";

import { Loader2, Send, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createTelegramCode, unlinkTelegram, type LinkCode } from "@/lib/telegram/link-actions";

const timeFmt = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/** Link or unlink the Telegram bot (follow-up spec §9.1). */
export function TelegramCard({ linked, linkedAt }: { linked: boolean; linkedAt: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState<LinkCode | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Send aria-hidden="true" className="size-5 text-sky" />
        <h2 className="font-semibold">Telegram</h2>
        {linked ? <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent-strong">מחובר</span> : null}
      </div>
      {linked ? (
        <>
          <p className="text-sm text-ink-muted">
            אפשר לדווח לבוט מה אכלת, כמה שתית ואיזו פעילות עשית, וזה נרשם כאן באתר.
            {linkedAt ? ` מחובר מ-${new Date(linkedAt).toLocaleDateString("he-IL")}.` : ""}
          </p>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await unlinkTelegram();
                router.refresh();
              })
            }
          >
            <Unlink aria-hidden="true" className="size-4" />
            נתק את Telegram
          </Button>
        </>
      ) : code?.ok ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">שלחו לבוט את הקוד הזה, או לחצו על הכפתור. הקוד תקף עד {timeFmt.format(new Date(code.expiresAt))} ועובד פעם אחת.</p>
          <span dir="ltr" className="num rounded-xl bg-field px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] select-all">
            {code.code}
          </span>
          {code.url ? (
            <a href={code.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 font-medium text-white hover:bg-brand-strong">
              <Send aria-hidden="true" className="size-4" />
              פתח את הבוט בטלגרם
            </a>
          ) : null}
          <Button variant="ghost" onClick={() => router.refresh()}>
            חיברתי, רענן
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted">דיווח מהיר מהטלפון: מה אכלת, מים ופעילות, ישר לאותו חשבון.</p>
          {code && !code.ok ? (
            <p role="status" className="rounded-xl bg-field px-4 py-3 text-sm">
              {code.reason === "not_configured" ? "הבוט עוד לא הוגדר באתר. אחרי ההגדרה הכפתור יעבוד." : "משהו השתבש. נסו שוב בעוד רגע."}
            </p>
          ) : null}
          <Button variant="secondary" disabled={pending} onClick={() => start(async () => setCode(await createTelegramCode()))}>
            {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
            חבר Telegram
          </Button>
        </>
      )}
    </div>
  );
}
