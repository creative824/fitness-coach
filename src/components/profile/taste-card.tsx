"use client";

import { Check, Loader2, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { ChipGroup } from "@/components/onboarding/fields";
import { TastePicker } from "@/components/onboarding/taste-picker";
import { saveTaste } from "@/lib/food/diary-actions";
import type { Taste } from "@/lib/food/prefs";
import { getDictionary } from "@/lib/i18n/he";
import { ALLERGENS } from "@/lib/onboarding/schema";

const o = getDictionary().screens.onboarding.options;
type Allergen = (typeof ALLERGENS)[number];

/** "הטעם שלי": what you like, don't like and don't eat, and allergies. Meal ideas follow it. */
export function TasteCard({ initial, allergies: initialAllergies }: { initial: Taste; allergies: Allergen[] }) {
  const [taste, setTaste] = useState(initial);
  const [allergies, setAllergies] = useState(initialAllergies);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const line = (xs: string[]) => (xs.length ? xs.slice(0, 6).join(", ") + (xs.length > 6 ? "…" : "") : "—");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">הטעם שלי</h2>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-field px-3 text-sm font-medium hover:bg-line/60">
            <Pencil aria-hidden="true" className="size-4" />
            עריכה
          </button>
        ) : null}
      </div>
      {!open ? (
        <dl className="grid gap-1.5 text-sm">
          <Row label="👍 אוהב" value={line(taste.likes)} />
          <Row label="👎 לא אוהב" value={line(taste.dislikes)} />
          <Row label="🚫 לא אוכל" value={line(taste.never)} />
          <Row label="⚠️ אלרגיות" value={line(allergies.map((a) => o.allergies[a]))} />
        </dl>
      ) : (
        <>
          <TastePicker value={taste} onChange={setTaste} />
          <ChipGroup
            label="אלרגיות"
            hint="אלרגיה היא הגבלה מחייבת: לא נציע שום דבר שמכיל אותה."
            options={ALLERGENS.map((a) => ({ value: a, label: o.allergies[a] }))}
            value={allergies}
            multiple
            onChange={setAllergies}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveTaste({ ...taste, allergies }).catch(() => ({ ok: false }));
                if (r.ok) {
                  setOpen(false);
                  setNote("נשמר. ההצעות לארוחות יתאימו לטעם שלך.");
                } else setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
              })
            }
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand font-medium text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
            שמירה
          </button>
        </>
      )}
      {note ? (
        <p role="status" className="rounded-xl bg-field px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
