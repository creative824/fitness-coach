"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cancelCompetition, leaveCompetition, removeMember, rotateInviteCode } from "@/lib/competitions/actions";
import { InviteCode } from "./create-form";

/** Owner tools: a new invite code (the old one stops working), remove a member, cancel. */
export function OwnerPanel({ id, members, open }: { id: string; members: { key: string; name: string }[]; open: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-semibold">ניהול התחרות</h2>
      {open ? (
        <>
          {code ? (
            <div className="rounded-xl bg-night p-3 text-white">
              <InviteCode code={code} />
              <p className="mt-2 text-xs text-white/70">הקוד הקודם הפסיק לעבוד.</p>
            </div>
          ) : null}
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await rotateInviteCode(id);
                if (r.ok) setCode(r.code);
                else setMsg("לא הצלחנו להפיק קוד.");
              })
            }
          >
            להפיק קוד הזמנה חדש
          </Button>
        </>
      ) : null}
      {members.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {members.map((m) => (
            <li key={m.key} className="flex min-h-12 items-center justify-between gap-3">
              <span className="truncate">{m.name}</span>
              <button
                type="button"
                disabled={pending}
                className="min-h-10 cursor-pointer rounded-lg px-3 text-sm text-danger hover:bg-danger/10"
                onClick={() => {
                  if (!confirm(`להסיר את ${m.name} מהתחרות? לא תהיה אפשרות להצטרף שוב.`)) return;
                  start(async () => {
                    const r = await removeMember(id, m.key);
                    setMsg(r.ok ? null : "ההסרה לא הצליחה.");
                    router.refresh();
                  });
                }}
              >
                להסיר
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <Button
          variant="ghost"
          disabled={pending}
          className="text-danger"
          onClick={() => {
            if (!confirm("לבטל את התחרות? אף אחד לא יקבל פרס.")) return;
            start(async () => {
              const r = await cancelCompetition(id);
              if (r.ok) router.refresh();
              else setMsg("הביטול לא הצליח.");
            });
          }}
        >
          לבטל את התחרות
        </Button>
      ) : null}
      {msg ? (
        <p role="alert" className="text-sm text-danger">
          {msg}
        </p>
      ) : null}
    </Card>
  );
}

export function LeaveButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      className="text-danger"
      onClick={() => {
        if (!confirm("לעזוב את התחרות? אפשר לחזור אחר כך עם קוד ההזמנה.")) return;
        start(async () => {
          const r = await leaveCompetition(id);
          if (r.ok) router.push("/competitions");
        });
      }}
    >
      לעזוב את התחרות
    </Button>
  );
}
