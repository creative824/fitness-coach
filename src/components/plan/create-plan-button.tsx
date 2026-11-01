"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/he";
import { createWeekPlan } from "@/lib/plan/actions";

const s = getDictionary().screens.plan;

/** Runs the plan engine for this week. "again" recreates it; completed tasks are kept. */
export function CreatePlanButton({ again = false }: { again?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant={again ? "secondary" : "primary"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await createWeekPlan().catch(() => ({ ok: false as const, reason: "db" as const }));
            if (!r.ok) setError(s.errors[r.reason]);
          })
        }
      >
        {again ? <RefreshCw aria-hidden="true" className={`size-4 ${pending ? "animate-spin" : ""}`} /> : <Sparkles aria-hidden="true" className="size-4" />}
        {pending ? s.creating : again ? s.recreate : s.create}
      </Button>
      {error ? (
        <p role="alert" className="max-w-sm text-center text-sm text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}
