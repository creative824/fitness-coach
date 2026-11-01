"use client";

import { Check, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { confirmFoodLog, deleteFoodLog } from "@/lib/food/actions";
import { MEAL_LABEL, totalsOf } from "@/lib/food/items";
import type { FoodLog } from "@/lib/food/data";

const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/** Today's reported meals. Drafts are marked and can be confirmed; nothing is judged. */
export function FoodList({ logs, tracking }: { logs: FoodLog[]; tracking: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean }>) => start(async () => { await fn(); router.refresh(); });

  if (!logs.length) return <p className="text-sm text-ink-muted">עוד לא נרשמו ארוחות היום.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-busy={pending}>
      {logs.map((l) => {
        const t = totalsOf(l.items);
        return (
          <li key={l.id} className="flex flex-col gap-2 rounded-xl bg-field p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {l.mealType ? MEAL_LABEL[l.mealType] : "ארוחה"}
                <span className="num text-xs font-normal text-ink-muted">{time.format(new Date(l.loggedAt))}</span>
                {l.source === "telegram" ? <Send aria-label="מטלגרם" className="size-3.5 text-ink-muted" /> : null}
                {l.status === "draft" ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">טיוטה</span> : null}
              </span>
              <span className="flex items-center gap-1">
                {l.status === "draft" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => confirmFoodLog(l.id))}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-medium hover:bg-surface"
                  >
                    <Check aria-hidden="true" className="size-4" />
                    אשר
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => deleteFoodLog(l.id))}
                  aria-label="מחיקת הארוחה"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </span>
            </div>
            <p className="text-sm">{l.text}</p>
            {l.items.length ? (
              <ul className="flex flex-col gap-0.5 text-xs text-ink-muted">
                {l.items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span>
                      {i.item_name}
                      {i.quantity ? ` · ${i.quantity}${i.unit ? ` ${i.unit}` : ""}` : ""}
                    </span>
                    {tracking && i.kcal_min !== null ? <span className="num" dir="ltr">{`${i.kcal_min}–${i.kcal_max}`}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {tracking && t.kcal ? (
              <p className="text-xs text-ink-muted">
                הערכה: <span className="num" dir="ltr">{`${t.kcal[0]}–${t.kcal[1]}`}</span> קל׳
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
