"use client";

import { ChevronDown, Lightbulb, Salad } from "lucide-react";
import { useState } from "react";
import { InfoButton } from "@/components/knowledge/info-button";
import { Card } from "@/components/ui/card";

export interface MealView {
  slotLabel: string;
  range: [number, number] | null;
  groups: string[];
  examples: string[];
  idea: { title: string; hint: string | null } | null;
  alternatives: string[];
}

/**
 * Meals of a day as a flexible frame (follow-up spec §6): what to combine, a rough range when
 * there is a basis for one, and examples that fit the user. A concrete idea opens on request.
 */
export function MealsCard({ meals, guide, platePersonal, caloriesPersonal }: { meals: MealView[]; guide: string; platePersonal: string | null; caloriesPersonal: string | null }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Salad aria-hidden="true" className="size-5 text-coral" />
          מסגרת לארוחות
        </h3>
        <InfoButton topic="plate" personal={platePersonal} />
      </div>
      <p className="text-sm text-ink-muted">{guide}</p>
      <ul className="flex flex-col gap-3">
        {meals.map((m, i) => (
          <li key={i} className="flex flex-col gap-1.5 border-s-2 border-coral/40 ps-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{m.slotLabel}</span>
              {m.range ? (
                <span className="inline-flex items-center gap-0.5 text-xs text-ink-muted">
                  הערכה: <span className="num" dir="ltr">{`${m.range[0]}–${m.range[1]}`}</span> קל׳
                  {i === 0 ? <InfoButton topic="calories" personal={caloriesPersonal} /> : null}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.groups.map((g) => (
                <span key={g} className="rounded-full bg-coral-soft px-2.5 py-0.5 text-xs">
                  {g}
                </span>
              ))}
            </div>
            {m.examples.length ? <p className="text-sm text-ink-muted">דוגמאות שמתאימות לך: {m.examples.join(" · ")}</p> : null}
            {m.idea ? (
              <>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="inline-flex min-h-9 w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink hover:bg-field"
                >
                  <Lightbulb aria-hidden="true" className="size-4 text-accent-strong" />
                  תן לי רעיון לארוחה
                  <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i ? (
                  <div className="flex flex-col gap-1 rounded-xl bg-field px-3 py-2 text-sm">
                    <span className="font-medium">{m.idea.title}</span>
                    {m.idea.hint ? <span className="text-ink-muted">{m.idea.hint}</span> : null}
                    {m.alternatives.length ? (
                      <span className="text-xs text-ink-muted">אין את זה בבית? אפשר במקום: {m.alternatives.join(" · ")}</span>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
