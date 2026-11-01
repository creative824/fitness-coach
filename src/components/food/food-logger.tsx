"use client";

import { Loader2, Plus, Sparkles, Trash2, CircleHelp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { analyzeFood, saveFoodLog } from "@/lib/food/actions";
import { CONFIDENCE_LABEL, MEAL_LABEL, MEAL_TYPES, totalsOf, type FoodItem, type MealType } from "@/lib/food/items";
import { FoodTotalsLine } from "./food-totals";

type Row = { [K in keyof FoodItem]: FoodItem[K] extends number | null ? string : FoodItem[K] } & { key: number };

let nextKey = 1;
const str = (v: number | null) => (v === null ? "" : String(v));
const toRow = (i: FoodItem): Row => ({
  ...i,
  key: nextKey++,
  quantity: str(i.quantity),
  kcal_min: str(i.kcal_min),
  kcal_max: str(i.kcal_max),
  protein_g: str(i.protein_g),
  carbs_g: str(i.carbs_g),
  fat_g: str(i.fat_g),
});
const blank = (): Row => toRow({ item_name: "", quantity: null, unit: null, preparation: null, kcal_min: null, kcal_max: null, protein_g: null, carbs_g: null, fat_g: null, confidence: null });
const numOrNull = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));
const fromRow = (r: Row): FoodItem => ({
  item_name: r.item_name,
  unit: r.unit,
  preparation: r.preparation,
  confidence: r.confidence,
  quantity: numOrNull(r.quantity),
  kcal_min: numOrNull(r.kcal_min),
  kcal_max: numOrNull(r.kcal_max),
  protein_g: numOrNull(r.protein_g),
  carbs_g: numOrNull(r.carbs_g),
  fat_g: numOrNull(r.fat_g),
});

const MESSAGES = {
  no_key: "ההערכה האוטומטית עוד לא הופעלה. אפשר להוסיף פריטים ידנית או לשמור רק את התיאור.",
  not_food: "לא זיהיתי כאן אוכל או שתייה. אפשר לנסח מחדש, למשל: \"2 פרוסות לחם מלא עם חביתה וסלט\".",
  failed: "לא הצלחתי להעריך הפעם. אפשר לנסות שוב או להוסיף פריטים ידנית.",
  limit: "הגעת למספר ההערכות האוטומטיות להיום. אפשר להוסיף פריטים ידנית, ומחר זה יתחדש.",
};

const fieldBase = "min-h-10 rounded-lg bg-field px-3 text-sm outline-none ring-1 ring-transparent focus:ring-ink/20";
const field = `${fieldBase} w-full`;

/** Free-text meal report with an estimate the user can edit before saving (follow-up spec §7). */
export function FoodLogger({ aiEnabled, tracking, defaultMeal }: { aiEnabled: boolean; tracking: boolean; defaultMeal: MealType }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [rows, setRows] = useState<Row[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [estimated, setEstimated] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Made on the first save attempt and kept for retries, so a repeated tap is not stored twice.
  const clientRef = useRef<string | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();

  const items = rows.map(fromRow).filter((i) => i.item_name.trim());
  const totals = totalsOf(items);

  function analyze() {
    setNote(null);
    startAnalyze(async () => {
      const r = await analyzeFood(text);
      if (r.ok) {
        setRows(r.items.map(toRow));
        setQuestion(r.question);
        setEstimated(true);
      } else {
        setNote(MESSAGES[r.reason]);
        if (r.reason !== "not_food" && !rows.length) setRows([blank()]);
      }
    });
  }

  function save(status: "draft" | "confirmed") {
    setNote(null);
    clientRef.current ??= crypto.randomUUID();
    const ref = clientRef.current;
    startSave(async () => {
      const r = await saveFoodLog({ text, mealType: meal, status, clientRef: ref, estimated, items });
      if (!r.ok) {
        setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
        return;
      }
      setText("");
      setRows([]);
      setQuestion(null);
      setEstimated(false);
      clientRef.current = null;
      setNote(status === "draft" ? "נשמר כטיוטה. אפשר לאשר אותה ברשימה למטה." : "נשמר.");
      router.refresh();
    });
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <Card className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-semibold">מה אכלת?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="למשל: 2 פרוסות לחם מלא עם חביתה מביצה אחת, סלט ירקות וכוס קפה עם חלב"
          className="w-full resize-y rounded-xl bg-field px-4 py-3 text-base outline-none ring-1 ring-transparent focus:ring-ink/20"
        />
      </label>

      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">איזו ארוחה</legend>
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            aria-pressed={meal === m}
            className={`min-h-9 cursor-pointer rounded-full px-3 text-sm transition-colors ${meal === m ? "bg-brand text-white" : "bg-field hover:bg-line/60"}`}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        {aiEnabled && tracking ? (
          <Button onClick={analyze} disabled={analyzing || text.trim().length < 2} variant="secondary">
            {analyzing ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
            {estimated ? "הערך שוב" : "הערך מה יש בארוחה"}
          </Button>
        ) : null}
        {tracking ? (
          <Button variant="ghost" onClick={() => setRows((rs) => [...rs, blank()])}>
            <Plus aria-hidden="true" className="size-4" />
            הוסף פריט
          </Button>
        ) : null}
      </div>

      {note ? (
        <p role="status" className="rounded-xl bg-field px-4 py-3 text-sm">
          {note}
        </p>
      ) : null}

      {question ? (
        <p className="flex items-start gap-2 rounded-xl bg-sky-soft px-4 py-3 text-sm">
          <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {question} <span className="text-ink-muted">אפשר להוסיף את התשובה לתיאור ולהעריך שוב, או לתקן ישירות בפריטים.</span>
          </span>
        </p>
      ) : null}

      {rows.length ? (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-col gap-2 rounded-xl ring-1 ring-line p-3">
              <div className="flex items-center gap-2">
                <input aria-label="פריט" value={r.item_name} onChange={(e) => update(r.key, { item_name: e.target.value })} placeholder="פריט" className={field} maxLength={120} />
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  aria-label={`הסרת ${r.item_name || "פריט"}`}
                  className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-field hover:text-ink"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input aria-label="כמות" inputMode="decimal" value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} placeholder="כמות" className={field} />
                <input aria-label="יחידה" value={r.unit ?? ""} onChange={(e) => update(r.key, { unit: e.target.value })} placeholder="יחידה" className={field} maxLength={30} />
                <input aria-label="הכנה" value={r.preparation ?? ""} onChange={(e) => update(r.key, { preparation: e.target.value })} placeholder="הכנה" className={field} maxLength={60} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-muted">קלוריות (הערכה)</span>
                <input aria-label="מינימום קלוריות" inputMode="numeric" dir="ltr" value={r.kcal_min} onChange={(e) => update(r.key, { kcal_min: e.target.value })} className={`${fieldBase} w-20 text-center`} />
                <span aria-hidden="true">–</span>
                <input aria-label="מקסימום קלוריות" inputMode="numeric" dir="ltr" value={r.kcal_max} onChange={(e) => update(r.key, { kcal_max: e.target.value })} className={`${fieldBase} w-20 text-center`} />
                {r.confidence ? <span className="rounded-full bg-field px-2 py-0.5 text-xs text-ink-muted">{CONFIDENCE_LABEL[r.confidence]}</span> : null}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-ink-muted">
                {(
                  [
                    ["protein_g", "חלבון (ג׳)"],
                    ["carbs_g", "פחמימות (ג׳)"],
                    ["fat_g", "שומן (ג׳)"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex flex-col gap-1">
                    {label}
                    <input inputMode="decimal" dir="ltr" value={r[k]} onChange={(e) => update(r.key, { [k]: e.target.value })} className={`${field} text-ink`} />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {tracking && items.length ? <FoodTotalsLine totals={totals} label="בארוחה הזו" /> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save("confirmed")} disabled={saving || !text.trim()}>
          {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          אשר ושמור
        </Button>
        <Button variant="secondary" onClick={() => save("draft")} disabled={saving || !text.trim()}>
          שמור כטיוטה
        </Button>
      </div>
      {tracking ? <p className="text-xs text-ink-muted">כל המספרים הם הערכה בלבד, ואפשר לתקן אותם לפני השמירה.</p> : null}
    </Card>
  );
}
