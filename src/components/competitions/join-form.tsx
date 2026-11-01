"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/onboarding/fields";
import { joinCompetition, type JoinResult } from "@/lib/competitions/actions";
import { KIND_INFO, MAX_MEMBERS, SHARED_RULES } from "@/lib/competitions/rules";

const ERRORS: Record<Exclude<JoinResult, { ok: true }>["reason"], string> = {
  invalid: "צריך קוד וכינוי.",
  wrong_code: "הקוד לא נמצא. כדאי לבדוק אותו מול מי ששלח, או לבקש קוד חדש.",
  full: `התחרות מלאה: כבר יש בה ${MAX_MEMBERS} משתתפים.`,
  over: "התחרות הזו כבר הסתיימה.",
  removed: "מנהל התחרות הסיר אותך ממנה.",
  limit: "אפשר להיות בעד 10 תחרויות פעילות בבת אחת.",
  failed: "לא הצלחנו לצרף אותך. אפשר לנסות שוב.",
};

/** Join by code. The formulas and rules are shown before joining (spec §5). */
export function JoinCompetitionForm({ initialCode, defaultNickname }: { initialCode: string; defaultNickname: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState(defaultNickname);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await joinCompetition({ code, nickname });
          if (r.ok) router.push(`/competitions/${r.id}`);
          else setError(ERRORS[r.reason]);
        });
      }}
    >
      <Card className="flex flex-col gap-5">
        <TextField label="קוד הזמנה" value={code} onChange={(v) => setCode(v.toUpperCase())} maxLength={12} placeholder="ABCD2345" />
        <TextField label="הכינוי שלך בטבלה" value={nickname} onChange={setNickname} maxLength={30} />
      </Card>
      <Card tone="glass" className="flex flex-col gap-3">
        <h2 className="font-semibold">לפני שמצטרפים</h2>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          {SHARED_RULES.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">איך מחשבים כל סוג תחרות</summary>
          <dl className="mt-2 flex flex-col gap-2">
            {Object.values(KIND_INFO).map((k) => (
              <div key={k.title}>
                <dt className="font-medium">{k.title}</dt>
                <dd className="text-ink-muted">{k.formula}</dd>
              </div>
            ))}
          </dl>
        </details>
      </Card>
      {error ? (
        <p role="alert" className="px-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !code.trim() || !nickname.trim()}>
        {pending ? "מצטרפים…" : "להצטרף"}
      </Button>
    </form>
  );
}
