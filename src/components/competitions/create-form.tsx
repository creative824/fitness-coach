"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup, TextField } from "@/components/onboarding/fields";
import { createCompetition } from "@/lib/competitions/actions";
import { DURATIONS, KIND_INFO, KINDS, type Kind } from "@/lib/competitions/rules";

const ERRORS = {
  invalid: "צריך שם לתחרות וכינוי.",
  limit: "אפשר להיות בעד 10 תחרויות פעילות בבת אחת.",
  failed: "לא הצלחנו ליצור את התחרות. אפשר לנסות שוב.",
} as const;

/** New competition: name, kind (with its formula), length, start day and a nickname. */
export function CreateCompetitionForm({ defaultNickname }: { defaultNickname: string }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("consistency");
  const [days, setDays] = useState<(typeof DURATIONS)[number]>(14);
  const [startTomorrow, setStartTomorrow] = useState(true);
  const [nickname, setNickname] = useState(defaultNickname);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [pending, start] = useTransition();

  if (created) return <CreatedCard {...created} />;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await createCompetition({
            name,
            kind,
            days,
            startTomorrow,
            nickname,
          });
          if (r.ok) setCreated({ id: r.id, code: r.code });
          else setError(ERRORS[r.reason]);
        });
      }}
    >
      <Card className="flex flex-col gap-5">
        <TextField label="שם התחרות" value={name} onChange={setName} maxLength={40} placeholder="למשל: החבר׳ה מהעבודה" />
        <ChipGroup
          label="על מה מתחרים"
          options={KINDS.map((k) => ({ value: k, label: KIND_INFO[k].title }))}
          value={[kind]}
          onChange={([k]) => k && setKind(k)}
        />
        <div className="rounded-xl bg-accent-soft px-4 py-3">
          <p className="text-xs font-semibold text-accent-strong">איך מחשבים את הציון</p>
          <p className="text-sm leading-relaxed">{KIND_INFO[kind].formula}</p>
        </div>
        <ChipGroup
          label="משך"
          options={DURATIONS.map((d) => ({ value: d, label: `${d} ימים` }))}
          value={[days]}
          onChange={([d]) => d && setDays(d)}
        />
        <ChipGroup
          label="מתי מתחילים"
          options={[
            { value: "tomorrow", label: "מחר" },
            { value: "today", label: "היום" },
          ]}
          value={[startTomorrow ? "tomorrow" : "today"]}
          onChange={([v]) => setStartTomorrow(v !== "today")}
        />
        <TextField
          label="הכינוי שלך בטבלה"
          value={nickname}
          onChange={setNickname}
          maxLength={30}
          hint="רק הכינוי והציון בתחרות גלויים לשאר המשתתפים."
        />
      </Card>
      {error ? (
        <p role="alert" className="px-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !name.trim() || !nickname.trim()}>
        {pending ? "יוצרים…" : "ליצור תחרות"}
      </Button>
    </form>
  );
}

function CreatedCard({ id, code }: { id: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/competitions/join?code=${code}`;
  return (
    <Card tone="night" className="flex flex-col gap-4 p-6">
      <h2 className="text-xl font-semibold">התחרות מוכנה</h2>
      <InviteCode code={code} />
      <p className="text-sm text-white/70">
        שלחו את הקישור או את הקוד לחברים. עד 20 משתתפים כולל אותך. שמרו אותו עכשיו: אנחנו לא שומרים את הקוד עצמו, ואפשר רק להפיק קוד חדש.
      </p>
      <Button
        variant="accent"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: "הצטרפות לתחרות", url: link });
            else {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }
          } catch {
            // The user closed the share sheet.
          }
        }}
      >
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        {copied ? "הקישור הועתק" : "לשתף קישור הזמנה"}
      </Button>
      <ButtonLink href={`/competitions/${id}`} variant="ghost" className="text-white hover:bg-white/10">
        לטבלת המנצחים
      </ButtonLink>
    </Card>
  );
}

/** The code, large and in LTR, with a copy button. */
export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-3">
      <span dir="ltr" className="font-mono text-2xl font-semibold tracking-[0.2em] text-accent">
        {code}
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            // Clipboard blocked: the code is on screen.
          }
        }}
        className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10"
      >
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        {copied ? "הועתק" : "העתקה"}
      </button>
    </div>
  );
}

export function BackLink() {
  return (
    <Link href="/competitions" className="w-fit text-sm text-ink-muted hover:text-ink">
      → כל התחרויות
    </Link>
  );
}
