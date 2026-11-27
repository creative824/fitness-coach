"use client";

import { Check, ChevronRight, Loader2, Pencil, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import type { Analysis } from "@/lib/food/analyze";
import { addMeal, analyzeMeal } from "@/lib/food/diary-actions";
import { foodsLine, scaleItem } from "@/lib/food/diary";
import { DIARY_MEALS, MEAL_EMOJI, MEAL_LABEL, type FoodItem, type MealType } from "@/lib/food/items";
import { ItemRows, MealTotals, useMealItems } from "./items";
import { Sheet } from "./sheet";

const PROBLEM: Record<string, string> = {
  no_key: "לא הצלחתי לזהות את זה לבד.",
  limit: "נגמרו להיום הזיהויים החכמים.",
  busy: "הזיהוי החכם עמוס כרגע.",
  bad_key: "הזיהוי החכם לא זמין כרגע.",
  failed: "לא הצלחתי לזהות את זה הפעם.",
};

export interface AddedMeal {
  kcal: number;
  protein: number;
}

type Step = "meal" | "text" | "result";

/**
 * "+ הוספת מנה", mounted on open so every time starts fresh:
 * 1. which meal (four big buttons), 2. "מה אכלת?" in your own words, 3. the count, with a
 * focused question only when the answer changes it a lot, 4. "אישור והוספה ליומן".
 */
export function AddMealSheet({ onClose, onAdded, showNumbers }: { onClose: () => void; onAdded: (m: AddedMeal) => void; showNumbers: boolean }) {
  const [step, setStep] = useState<Step>("meal");
  const [meal, setMeal] = useState<MealType>("breakfast");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  /** The food each question is about (by identity, so removing a food does not mix them up), and the answer picked. */
  const [asks, setAsks] = useState<{ original: FoodItem; item: FoodItem; text: string; options: { label: string; factor: number }[]; picked: number | null }[]>([]);
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [saving, startSave] = useTransition();
  const items = useMealItems([]);
  const clientRef = useRef<string | null>(null);

  function show(a: Analysis) {
    setAnalysis(a);
    items.reset(a.items);
    setAsks(a.asks.flatMap((q) => (a.items[q.index] ? [{ original: a.items[q.index], item: a.items[q.index], text: q.text, options: q.options, picked: null }] : [])));
    setEditing(false);
    setAnswer("");
    setStep("result");
  }

  function calculate(input = text) {
    setNote(null);
    if (input.trim().length < 2) return;
    start(async () => {
      const r = await analyzeMeal(input).catch(() => ({ ok: false as const }));
      if (!r.ok) {
        setNote("לא הצלחתי לחשב כרגע. נסו שוב בעוד רגע.");
        return;
      }
      if (r.analysis.notFood) {
        setNote("לא זיהיתי כאן אוכל. נסו לכתוב למשל: ״2 ביצים ופרוסת לחם״.");
        return;
      }
      show(r.analysis);
    });
  }

  function pick(k: number, o: number) {
    const q = asks[k];
    const i = items.base.indexOf(q.item);
    if (i < 0) return;
    // "כף טחינה (גדושה)": the same amount in words, with the numbers of the answer.
    const { factor, label } = q.options[o];
    const scaled = scaleItem(q.original, factor);
    const item: FoodItem = factor === 1 ? q.original : { ...scaled, item_name: `${q.original.item_name} (${label})`, quantity: q.original.quantity, unit: q.original.unit };
    items.replace(i, item);
    setAsks((list) => list.map((x, j) => (j === k ? { ...x, item, picked: o } : x)));
  }

  /** The AI's question: an amount to add to the text (and count again), or calories for an unknown food. */
  function answerQuestion() {
    if (!analysis) return;
    const v = answer.trim();
    if (!v) return;
    if (analysis.unknown.length && /^\d{1,4}$/.test(v)) {
      const kcal = Number(v);
      items.add([
        { item_name: analysis.unknown.join(", ").slice(0, 120), quantity: null, unit: null, preparation: null, kcal_min: kcal, kcal_max: kcal, protein_g: null, carbs_g: null, fat_g: null, confidence: "low" },
      ]);
      setAnalysis({ ...analysis, unknown: [] });
      setAnswer("");
      return;
    }
    const next = `${text.trim()}, ${v}`;
    setText(next);
    calculate(next);
  }

  function save() {
    clientRef.current ??= crypto.randomUUID();
    const ref = clientRef.current;
    const { kcal, protein } = items;
    const estimated = Boolean(analysis?.usedAi) || items.items.some((i) => i.confidence !== "high");
    startSave(async () => {
      const r = await addMeal({ text: text.trim() || foodsLine(items.items) || "מנה", mealType: meal, clientRef: ref, items: items.items, estimated }).catch(() => ({ ok: false }));
      if (!r.ok) {
        setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
        return;
      }
      onAdded({ kcal, protein });
    });
  }

  const question = analysis ? (analysis.unknown.length ? `כמה קלוריות בערך היו ב${analysis.unknown.join(", ")}?` : analysis.question) : null;
  const big = "inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-white hover:bg-brand-strong disabled:opacity-50";

  return (
    <Sheet
      open
      onClose={onClose}
      title={step === "meal" ? "לאיזו ארוחה?" : step === "text" ? "מה אכלת?" : "זה מה שאכלת"}
      footer={
        step === "text" ? (
          <button type="button" onClick={() => calculate()} disabled={busy || text.trim().length < 2} className={big}>
            {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Sparkles aria-hidden="true" className="size-5" />}
            {busy ? "מחשב…" : "חישוב קלוריות"}
          </button>
        ) : step === "result" ? (
          <button type="button" onClick={save} disabled={saving || !items.items.length} className={big}>
            {saving ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Check aria-hidden="true" className="size-5" />}
            אישור והוספה ליומן
          </button>
        ) : undefined
      }
    >
      {step === "meal" ? (
        <div className="grid grid-cols-2 gap-2.5">
          {DIARY_MEALS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMeal(m);
                setStep("text");
              }}
              className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface text-lg font-semibold shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] hover:bg-white active:scale-[0.98]"
            >
              <span aria-hidden="true" className="text-3xl">
                {MEAL_EMOJI[m]}
              </span>
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>
      ) : null}

      {step === "text" ? (
        <>
          <BackTo label={MEAL_LABEL[meal]} onClick={() => setStep("meal")} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) calculate();
            }}
            rows={5}
            maxLength={1000}
            autoFocus
            placeholder="למשל: אכלתי שתי ביצים, שתי פרוסות לחם מלא, סלט וכף טחינה."
            aria-label="מה אכלת"
            className="min-h-40 w-full resize-none rounded-2xl bg-surface p-4 text-lg leading-relaxed shadow-[var(--shadow-card)] ring-1 ring-line outline-none focus:ring-2 focus:ring-ink/25"
          />
          <p className="text-sm text-ink-muted">אפשר לכתוב גם בערך: ״צלחת אורז״, ״קצת טחינה״, ״חופן אגוזים״.</p>
        </>
      ) : null}

      {step === "result" ? (
        <>
          <BackTo label={`${MEAL_LABEL[meal]} · לשינוי הטקסט`} onClick={() => setStep("text")} />
          <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
            <h3 className="text-lg leading-snug font-semibold">{foodsLine(items.items) || "המנה שלך"}</h3>
            <ItemRows meal={items} editable={editing} showNumbers={showNumbers} />
            {showNumbers ? <MealTotals meal={items} /> : null}
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
              className="mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-field font-medium hover:bg-line/70"
            >
              <Pencil aria-hidden="true" className="size-4" />
              {editing ? "סיום עריכה" : "עריכת פרטים וכמויות"}
            </button>
          </div>

          {asks.map((q, k) => (
            <fieldset key={k} className="flex flex-col gap-2 rounded-2xl bg-warning-soft p-4">
              <legend className="contents font-medium">{q.text}</legend>
              <div className="flex gap-2">
                {q.options.map((o, j) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => pick(k, j)}
                    aria-pressed={q.picked === j}
                    className={`min-h-11 flex-1 cursor-pointer rounded-xl font-medium transition-colors ${q.picked === j ? "bg-brand text-white" : "bg-surface ring-1 ring-line hover:bg-field"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          {question ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-warning-soft p-4">
              <p className="font-medium">{question}</p>
              {analysis?.aiProblem ? <p className="text-sm text-ink-muted">{PROBLEM[analysis.aiProblem] ?? PROBLEM.failed} אפשר לענות או לדלג.</p> : null}
              <div className="flex gap-2">
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value.slice(0, 80))}
                  onKeyDown={(e) => e.key === "Enter" && answerQuestion()}
                  inputMode={analysis?.unknown.length ? "numeric" : "text"}
                  placeholder={analysis?.unknown.length ? "למשל 200" : "התשובה שלך"}
                  aria-label={question}
                  className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 ring-1 ring-line outline-none focus:ring-ink/30"
                />
                <button type="button" onClick={answerQuestion} disabled={!answer.trim() || busy} className="min-h-11 cursor-pointer rounded-xl bg-brand px-4 font-medium text-white disabled:opacity-40">
                  {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : "עדכון"}
                </button>
              </div>
            </div>
          ) : null}

          {analysis?.usedAi ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Sparkles aria-hidden="true" className="size-3.5" />
              המנה פוענחה בעזרת בינה מלאכותית, והערכים חושבו ממאגר המזון.
            </p>
          ) : null}
        </>
      ) : null}

      {note ? (
        <p role="status" className="rounded-xl bg-field px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
    </Sheet>
  );
}

function BackTo({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-full bg-surface px-3 text-sm font-medium ring-1 ring-line hover:bg-field">
      <ChevronRight aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
