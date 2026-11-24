"use client";

import { BookmarkPlus, Check, Loader2, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { UnderstandMealResult } from "@/lib/food/estimate";
import type { FoodItem } from "@/lib/food/items";
import { ACCURACY_LABEL, computeMeal, itemsOf, pointOf, rounded, type MealResult, type Per100, type Range, type Source, type Understanding } from "@/lib/food/recipe";
import type { SavedFood } from "@/lib/food/saved";

const SOURCE_LABEL: Record<Source, string> = { label: "מהתווית שלך", product: "ממאגר מוצרים", db: "ממאגר המזון", ai: "הערכה", none: "לא ידוע" };
const MESSAGES: Record<string, string> = {
  no_key: "החישוב החכם לא מופעל כרגע.",
  not_food: "לא זיהיתי כאן אוכל. נסו לנסח אחרת.",
  bad_key: "החישוב החכם לא מצליח להתחבר כרגע.",
  busy: "החישוב החכם עמוס. נסו שוב בעוד דקה.",
  failed: "לא הצלחתי להבין הפעם. נסו לפרט את המרכיבים והכמויות.",
  limit: "נגמרו החישובים החכמים להיום.",
};

const fmt = (x: Range, step = 1) => {
  const a = Math.round(x[0] / step) * step;
  const b = Math.round(x[1] / step) * step;
  return a === b ? a.toLocaleString("he-IL") : `${a.toLocaleString("he-IL")}–${b.toLocaleString("he-IL")}`;
};

export type SaveFood = (input: {
  name: string;
  kind: "recipe" | "food";
  unitName: string | null;
  yieldUnits: number | null;
  perUnit: MealResult["total"];
  accuracy: MealResult["accuracy"];
  recipe: { understanding: Understanding; answers: Record<string, number>; labels: Record<number, Per100> };
}) => Promise<{ ok: true; food: SavedFood } | { ok: false }>;

/**
 * A recipe or a home-made dish, worked out step by step: the AI only reads the words, then the
 * code counts every ingredient from the best source, asks for what is missing (with the usual
 * sizes as one-tap answers), and shows the whole recipe, one unit and the share eaten, with
 * ranges and how accurate it is. The result goes into the meal, and can be saved as "my recipe".
 */
export function RecipeCalculator({
  text,
  understand,
  save,
  initial,
  onAdd,
  onSaved,
  onClose,
}: {
  text: string;
  understand: (text: string) => Promise<UnderstandMealResult>;
  save: SaveFood | null;
  /** A saved recipe being edited. */
  initial?: SavedFood | null;
  onAdd: (items: FoodItem[]) => void;
  onSaved?: (food: SavedFood) => void;
  onClose: () => void;
}) {
  const [u, setU] = useState<Understanding | null>(initial?.recipe?.understanding ?? null);
  const [answers, setAnswers] = useState<Record<string, number>>(initial?.recipe?.answers ?? {});
  const [labels, setLabels] = useState<Record<number, Per100>>(initial?.recipe?.labels ?? {});
  const [labelFor, setLabelFor] = useState<number | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (initial?.recipe) return;
    startLoad(async () => {
      const r = await understand(text).catch((): UnderstandMealResult => ({ ok: false, reason: "failed" }));
      if (r.ok) {
        setU(r.understanding);
        setName(r.understanding.dish);
      } else setNote(MESSAGES[r.reason] ?? MESSAGES.failed);
    });
    // Run once, for the text it was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = useMemo(() => (u ? computeMeal(u, { answers, labels }) : null), [u, answers, labels]);

  if (loading || (!u && !note)) {
    return (
      <Box onClose={onClose}>
        <p className="flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          קורא את המתכון…
        </p>
      </Box>
    );
  }
  if (!u || !m) {
    return (
      <Box onClose={onClose}>
        <p className="text-sm">{note}</p>
      </Box>
    );
  }

  const isRecipe = m.kind === "recipe";
  const unit = m.unitName ?? "יחידות";
  const answer = (key: string, v: number) => setAnswers((a) => ({ ...a, [key]: v }));
  const meal = rounded(m.meal);
  const perUnit = m.perUnit ? rounded(m.perUnit) : null;
  const total = rounded(m.total);

  function doSave() {
    if (!save || !m || !u) return;
    const perOne = m.perUnit ?? m.total;
    startSave(async () => {
      const r = await save({
        name: name.trim() || m.dish,
        kind: isRecipe ? "recipe" : "food",
        unitName: isRecipe ? unit : "מנה",
        yieldUnits: m.yieldUnits ? pointOf(m.yieldUnits) : null,
        perUnit: perOne,
        accuracy: m.accuracy,
        recipe: { understanding: u, answers, labels },
      }).catch(() => ({ ok: false as const }));
      if (r.ok) {
        setSaved(true);
        onSaved?.(r.food);
      } else setNote("לא הצלחנו לשמור את המתכון. נסו שוב.");
    });
  }

  return (
    <Box onClose={onClose}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold">{m.dish}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.accuracy === "high" ? "bg-accent text-ink" : m.accuracy === "medium" ? "bg-sky-soft" : "bg-warning-soft text-warning"}`}>
          {ACCURACY_LABEL[m.accuracy]}
        </span>
      </div>

      {m.questions.length ? (
        <div className="flex flex-col gap-2">
          {m.questions.slice(0, 3).map((q) => (
            <div key={q.key} className="flex flex-col gap-1.5 rounded-lg bg-surface p-2.5 ring-1 ring-line">
              <span className="text-sm font-medium">{q.text}</span>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o) => (
                  <button key={o.label} type="button" onClick={() => answer(q.key, o.value)} className="min-h-9 cursor-pointer rounded-full bg-field px-3 text-sm hover:bg-line/60">
                    {o.label}
                  </button>
                ))}
                <NumberAnswer onAnswer={(v) => answer(q.key, v)} unit={q.key.startsWith("g:") ? "גרם" : ""} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-ink/5 rounded-lg bg-surface px-2.5 ring-1 ring-line">
        {m.lines.map((l, k) => (
          <li key={k} className="flex flex-col gap-1 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{l.name}</span>
              <span className="num shrink-0 text-sm">{fmt(l.kcal, 5)} קל׳</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <span className="num">
                {fmt(l.grams, 5)} גרם{l.gramsKnown ? "" : " (משוער)"}
              </span>
              <span>· {SOURCE_LABEL[l.source]}{l.matched && l.source === "db" && l.matched !== l.name ? ` (${l.matched})` : ""}</span>
              <button type="button" onClick={() => setLabelFor(labelFor === k ? null : k)} className="inline-flex cursor-pointer items-center gap-1 underline underline-offset-2">
                <Tag aria-hidden="true" className="size-3" />
                {labels[k] ? "עריכת התווית" : "יש לי תווית"}
              </button>
              {answers[`g:${k}`] ? null : (
                <WeightEdit onSet={(g) => answer(`g:${k}`, g)} />
              )}
            </div>
            {labelFor === k ? (
              <LabelForm
                initial={labels[k] ?? l.per100}
                onSave={(v) => {
                  setLabels((x) => ({ ...x, [k]: v }));
                  setLabelFor(null);
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {isRecipe ? (
        <div className="grid grid-cols-2 gap-2">
          <Count label={`כמה ${unit} יצאו`} value={m.yieldUnits} onSet={(v) => answer("yield", v)} />
          <Count label={`כמה ${unit} אכלת`} value={m.eaten} onSet={(v) => answer("eaten", v)} step={0.5} />
        </div>
      ) : null}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Fig label="כל המתכון" value={`${fmt(total.kcal, 10)}`} />
        <Fig label={isRecipe ? `ל${unit === "יחידות" ? "יחידה" : "יחידה אחת"}` : "חלק שנאכל"} value={perUnit ? fmt(perUnit.kcal, 5) : `${Math.round(pointOf(m.share) * 100)}%`} />
        <Fig label="מה שאכלת" value={fmt(meal.kcal, 5)} strong />
      </dl>
      <p className="text-xs text-ink-muted">
        מה שאכלת: חלבון <span className="num">{fmt(meal.protein)}</span> ג׳ · פחמימות <span className="num">{fmt(meal.carbs)}</span> ג׳ · שומן <span className="num">{fmt(meal.fat)}</span> ג׳
        {m.eaten && m.yieldUnits ? (
          <>
            {" "}
            · <span className="num">{Math.round(m.share[0] * 1000) / 10}%–{Math.round(m.share[1] * 1000) / 10}%</span> מהמתכון
          </>
        ) : null}
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            onAdd(itemsOf(m));
            onClose();
          }}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand font-medium text-white hover:bg-brand-strong"
        >
          <Check aria-hidden="true" className="size-4" />
          הוספה לארוחה
        </button>
        {save ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value.slice(0, 80));
                setSaved(false);
              }}
              aria-label="שם המתכון"
              className="min-h-10 min-w-0 flex-1 rounded-lg bg-surface px-2 text-sm ring-1 ring-line outline-none focus:ring-ink/30"
            />
            <button
              type="button"
              onClick={doSave}
              disabled={saving || saved || !name.trim()}
              className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium ring-1 ring-line hover:bg-white disabled:opacity-60"
            >
              {saved ? <Check aria-hidden="true" className="size-4" /> : <BookmarkPlus aria-hidden="true" className="size-4" />}
              {saved ? "נשמר" : isRecipe ? "שמירה במתכונים שלי" : "שמירה כמאכל קבוע"}
            </button>
          </div>
        ) : null}
        {saved ? <p className="text-xs text-ink-muted">בפעם הבאה אפשר לכתוב, למשל, &quot;אכלתי 3 {name.trim()}&quot;.</p> : null}
        {note ? <p role="alert" className="text-xs text-warning">{note}</p> : null}
      </div>
    </Box>
  );
}

function Box({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="relative flex flex-col gap-3 rounded-xl bg-field p-3">
      <button type="button" onClick={onClose} aria-label="סגירת המחשבון" className="absolute top-2 end-2 flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-surface">
        <X aria-hidden="true" className="size-4" />
      </button>
      <span className="text-xs font-semibold text-ink-muted">חישוב מתכון</span>
      {children}
    </div>
  );
}

function Fig({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex flex-col rounded-lg p-2 ${strong ? "bg-accent-soft ring-1 ring-accent" : "bg-surface ring-1 ring-line"}`}>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className={`num ${strong ? "text-lg font-bold" : "text-base font-semibold"}`}>
        <span dir="ltr">{value}</span> <span className="text-xs font-normal">קל׳</span>
      </dd>
    </div>
  );
}

function NumberAnswer({ onAnswer, unit }: { onAnswer: (v: number) => void; unit: string }) {
  const [v, setV] = useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <input
        inputMode="decimal"
        dir="ltr"
        value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
        onKeyDown={(e) => e.key === "Enter" && Number(v) > 0 && onAnswer(Number(v))}
        placeholder="אחר"
        aria-label={`ערך אחר${unit ? ` ב${unit}` : ""}`}
        className="num min-h-9 w-16 rounded-full bg-surface px-2 text-center text-sm ring-1 ring-line outline-none focus:ring-ink/30"
      />
      <button type="button" disabled={!(Number(v) > 0)} onClick={() => onAnswer(Number(v))} className="min-h-9 cursor-pointer px-1 text-sm font-medium underline underline-offset-2 disabled:opacity-40">
        אישור
      </button>
    </span>
  );
}

function WeightEdit({ onSet }: { onSet: (g: number) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer underline underline-offset-2">
        המשקל המדויק
      </button>
    );
  return <NumberAnswer unit="גרם" onAnswer={onSet} />;
}

function Count({ label, value, onSet, step = 1 }: { label: string; value: Range | null; onSet: (v: number) => void; step?: number }) {
  const cur = value ? pointOf(value) : null;
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-surface p-2 ring-1 ring-line">
      <span className="text-[11px] text-ink-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => cur && cur - step > 0 && onSet(cur - step)} disabled={!cur || cur - step <= 0} aria-label={`פחות: ${label}`} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-field text-lg disabled:opacity-40">
          −
        </button>
        <span dir="ltr" className="num min-w-12 text-center text-lg font-bold">{value ? fmt(value, step < 1 ? 0.5 : 1) : "?"}</span>
        <button type="button" onClick={() => onSet((cur ?? 0) + step)} aria-label={`יותר: ${label}`} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-field text-lg">
          +
        </button>
      </div>
    </div>
  );
}

function LabelForm({ initial, onSave }: { initial: Per100 | null; onSave: (v: Per100) => void }) {
  const [v, setV] = useState({ kcal: String(initial?.kcal ?? ""), p: String(initial?.p ?? ""), c: String(initial?.c ?? ""), f: String(initial?.f ?? "") });
  const ok = Number(v.kcal) > 0 && Number(v.kcal) <= 900;
  const field = (k: keyof typeof v, label: string) => (
    <label className="flex flex-col gap-0.5 text-[11px] text-ink-muted">
      {label}
      <input
        inputMode="decimal"
        dir="ltr"
        value={v[k]}
        onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) }))}
        className="num min-h-9 w-full rounded-lg bg-field px-2 text-center text-sm text-ink ring-1 ring-line outline-none"
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-field/60 p-2">
      <span className="text-xs">ערכים ל-100 גרם, כמו שכתוב על האריזה:</span>
      <div className="grid grid-cols-4 gap-1.5">
        {field("kcal", "קלוריות")}
        {field("p", "חלבון")}
        {field("c", "פחמימות")}
        {field("f", "שומן")}
      </div>
      <button
        type="button"
        disabled={!ok}
        onClick={() => onSave({ kcal: Number(v.kcal), p: Math.min(100, Number(v.p) || 0), c: Math.min(100, Number(v.c) || 0), f: Math.min(100, Number(v.f) || 0) })}
        className="min-h-9 cursor-pointer rounded-lg bg-brand text-sm font-medium text-white disabled:opacity-40"
      >
        שימוש בתווית
      </button>
    </div>
  );
}
