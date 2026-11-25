"use client";

import { Camera, Check, Clock, Loader2, Pencil, PenLine, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import type { Analysis } from "@/lib/food/analyze";
import { addMeal, analyzeMeal, readMealPhoto } from "@/lib/food/diary-actions";
import { foodsLine, kcalMid } from "@/lib/food/diary";
import { MEAL_LABEL, MEAL_TYPES, type FoodItem, type MealType } from "@/lib/food/items";
import type { RecentMeal } from "@/lib/food/recent";
import { ItemRows, MealTotals, useMealItems } from "./items";
import { Sheet } from "./sheet";

type Mode = "text" | "photo" | "recent";

const PROBLEM: Record<string, string> = {
  no_key: "לא הצלחתי לזהות את זה לבד.",
  limit: "נגמרו להיום הזיהויים החכמים.",
  busy: "הזיהוי החכם עמוס כרגע.",
  bad_key: "הזיהוי החכם לא זמין כרגע.",
  failed: "לא הצלחתי לזהות את זה הפעם.",
};

const PHOTO_PROBLEM: Record<string, string> = {
  no_key: "זיהוי מתמונה לא מופעל כרגע. אפשר לכתוב במילים.",
  not_food: "לא זיהיתי אוכל בתמונה. נסו תמונה אחרת או כתבו במילים.",
  limit: "נגמרו להיום הזיהויים החכמים. אפשר לכתוב במילים.",
  busy: "הזיהוי עמוס כרגע. נסו שוב בעוד דקה או כתבו במילים.",
  bad_key: "הזיהוי מתמונה לא זמין כרגע. אפשר לכתוב במילים.",
  failed: "לא הצלחתי לקרוא את התמונה. אפשר לכתוב במילים.",
};

export interface AddedMeal {
  kcal: number;
  protein: number;
}

/**
 * Mounted on open (and unmounted on close), so every time starts fresh.
 * "מה אכלת?": pick the meal, write what you ate in your own words (or take a photo, or tap a
 * recent meal), "חשב והוסף ליומן", then one tap to add. Amounts can be changed before adding.
 */
export function AddMealSheet({
  open,
  onClose,
  onAdded,
  defaultMeal,
  recent,
  showNumbers,
  photoEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (m: AddedMeal) => void;
  defaultMeal: MealType;
  recent: RecentMeal[];
  showNumbers: boolean;
  photoEnabled: boolean;
}) {
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [saving, startSave] = useTransition();
  const items = useMealItems([]);
  const clientRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function show(a: Analysis) {
    setAnalysis(a);
    items.reset(a.items);
    setEditing(false);
    setAnswer("");
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

  function pickRecent(m: RecentMeal) {
    setText(m.text);
    show({ items: m.items, question: null, unknown: [], notFood: false, usedAi: false, aiProblem: null });
  }

  async function onPhoto(file: File) {
    setNote(null);
    start(async () => {
      const img = await shrink(file).catch(() => null);
      if (!img) {
        setNote(PHOTO_PROBLEM.failed);
        return;
      }
      const r = await readMealPhoto(img).catch(() => ({ ok: false as const, reason: "failed" as const }));
      if (!r.ok) {
        setNote(PHOTO_PROBLEM[r.reason] ?? PHOTO_PROBLEM.failed);
        setMode("text");
        return;
      }
      setText(r.text);
      setMode("text");
      const a = await analyzeMeal(r.text).catch(() => ({ ok: false as const }));
      if (a.ok && !a.analysis.notFood) show(a.analysis);
    });
  }

  /** The one question: an amount to add to the text (and count again), or calories for an unknown food. */
  function answerQuestion() {
    if (!analysis) return;
    const v = answer.trim();
    if (!v) return;
    if (analysis.unknown.length && /^\d{1,4}$/.test(v)) {
      const kcal = Number(v);
      const manual: FoodItem = {
        item_name: analysis.unknown.join(", ").slice(0, 120),
        quantity: null,
        unit: null,
        preparation: null,
        kcal_min: kcal,
        kcal_max: kcal,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        confidence: "low",
      };
      items.add([manual]);
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
    const kcal = items.kcal;
    const protein = items.protein;
    const estimated = Boolean(analysis?.usedAi) || items.items.some((i) => i.confidence !== "high");
    startSave(async () => {
      const r = await addMeal({ text: text.trim() || foodsLine(items.items) || "ארוחה", mealType: meal, clientRef: ref, items: items.items, estimated }).catch(() => ({
        ok: false,
      }));
      if (!r.ok) {
        setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
        return;
      }
      onAdded({ kcal, protein });
    });
  }

  const question = analysis ? (analysis.unknown.length ? `כמה קלוריות בערך היו ב${analysis.unknown.join(", ")}?` : analysis.question) : null;
  const confirm = analysis !== null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={confirm ? "הבנתי מה אכלת" : "מה אכלת?"}
      footer={
        confirm ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !items.items.length}
              className="inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Check aria-hidden="true" className="size-5" />}
              אישור והוספה ליומן
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing((e) => !e)}
                aria-pressed={editing}
                className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-surface font-medium ring-1 ring-line hover:bg-field"
              >
                <Pencil aria-hidden="true" className="size-4" />
                {editing ? "סיום עריכה" : "עריכת כמויות"}
              </button>
              <button type="button" onClick={() => setAnalysis(null)} className="min-h-11 cursor-pointer rounded-xl px-4 text-ink-muted hover:bg-field hover:text-ink">
                חזרה לטקסט
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => calculate()}
            disabled={busy || text.trim().length < 2}
            className="inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Sparkles aria-hidden="true" className="size-5" />}
            {busy ? "מחשב…" : "חשב והוסף ליומן"}
          </button>
        )
      }
    >
      {confirm ? (
        <>
          <p className="text-sm text-ink-muted">
            {MEAL_LABEL[meal]} · {text.length > 70 ? `${text.slice(0, 70)}…` : text}
          </p>
          <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
            <ItemRows meal={items} editable={editing} showNumbers={showNumbers} />
            {showNumbers ? <MealTotals meal={items} /> : null}
          </div>
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
                <button
                  type="button"
                  onClick={answerQuestion}
                  disabled={!answer.trim() || busy}
                  className="min-h-11 cursor-pointer rounded-xl bg-brand px-4 font-medium text-white disabled:opacity-40"
                >
                  {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : "עדכון"}
                </button>
              </div>
            </div>
          ) : null}
          {items.items.some((i) => i.confidence === "low") && showNumbers ? (
            <p className="text-xs text-ink-muted">חלק מהכמויות הוערכו לפי מנה רגילה. אפשר לשנות ב״עריכת כמויות״.</p>
          ) : null}
        </>
      ) : (
        <>
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">איזו ארוחה</legend>
            {MEAL_TYPES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeal(m)}
                aria-pressed={meal === m}
                className={`min-h-10 cursor-pointer rounded-full px-3.5 text-sm font-medium transition-colors ${meal === m ? "bg-brand text-white" : "bg-surface ring-1 ring-line hover:bg-field"}`}
              >
                {MEAL_LABEL[m]}
              </button>
            ))}
          </fieldset>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) calculate();
            }}
            rows={4}
            maxLength={1000}
            autoFocus
            placeholder="למשל: אכלתי 2 ביצים, 2 פרוסות לחם מלא, סלט עם מלפפון ועגבנייה וכף טחינה"
            aria-label="מה אכלת"
            className="min-h-32 w-full resize-none rounded-2xl bg-surface p-4 text-lg leading-relaxed shadow-[var(--shadow-card)] ring-1 ring-line outline-none focus:ring-2 focus:ring-ink/25"
          />

          <div role="tablist" aria-label="דרך הוספה" className="flex gap-1.5">
            <ModeButton active={mode === "text"} onClick={() => setMode("text")} Icon={PenLine} label="כתיבה חופשית" />
            {photoEnabled ? (
              <ModeButton
                active={mode === "photo"}
                onClick={() => {
                  setMode("photo");
                  fileRef.current?.click();
                }}
                Icon={Camera}
                label="צילום אוכל"
              />
            ) : null}
            {recent.length ? <ModeButton active={mode === "recent"} onClick={() => setMode(mode === "recent" ? "text" : "recent")} Icon={Clock} label="אחרונים" /> : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onPhoto(f);
              else setMode("text");
            }}
          />
          {mode === "photo" && busy ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              מזהה מה יש בתמונה…
            </p>
          ) : null}

          {mode === "recent" ? (
            <ul className="flex flex-col gap-1.5">
              {recent.map((m) => {
                const kcal = m.items.reduce((a, i) => a + kcalMid(i), 0);
                return (
                  <li key={m.text}>
                    <button
                      type="button"
                      onClick={() => pickRecent(m)}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-start ring-1 ring-line hover:bg-field"
                    >
                      <span className="min-w-0 truncate">{m.text}</span>
                      {showNumbers && kcal ? (
                        <span className="shrink-0 text-sm text-ink-muted">
                          <span className="num font-semibold text-ink">{kcal}</span> קל׳
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {mode === "text" ? <p className="text-sm text-ink-muted">אפשר לכתוב גם בערך: ״צלחת גדולה של אורז״, ״קצת טחינה״, ״חופן אגוזים״.</p> : null}
        </>
      )}
      {note ? (
        <p role="status" className="rounded-xl bg-field px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
    </Sheet>
  );
}

function ModeButton({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: typeof Camera; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${active ? "bg-accent-soft font-medium text-ink ring-1 ring-accent-strong/30" : "text-ink-muted hover:bg-field hover:text-ink"}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

/** A photo made small enough to send (longest side 1024 px, JPEG). */
async function shrink(file: File): Promise<{ mime: "image/jpeg"; data: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.8);
  return { mime: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}
