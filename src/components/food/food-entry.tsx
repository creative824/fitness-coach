"use client";

import { BookOpen, Calculator, Loader2, Minus, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { analyzeFood } from "@/lib/food/actions";
import type { UnderstandMealResult } from "@/lib/food/estimate";
import { matchSaved, savedItem, type SavedFood } from "@/lib/food/saved";
import { saveFood, understandFood } from "@/lib/food/saved-actions";
import { RecipeCalculator, type SaveFood } from "./recipe-calculator";
import type { FoodItem } from "@/lib/food/items";
import { describeItem, parseFood, stepFor, withQuantity, type ParsedItem } from "@/lib/food/parse";

/** Middle of an item's range: the one number shown for it. */
export const kcalOf = (i: Pick<FoodItem, "kcal_min" | "kcal_max">) =>
  i.kcal_min === null || i.kcal_max === null ? 0 : Math.round((i.kcal_min + i.kcal_max) / 2);

const AI_MESSAGES: Record<string, string> = {
  no_key: "ההערכה החכמה לא מופעלת. אפשר לכתוב כמה קלוריות בערך.",
  not_food: "גם ההערכה החכמה לא זיהתה כאן אוכל. אפשר לנסח אחרת או לכתוב קלוריות בעצמך.",
  bad_key: "ההערכה החכמה לא מצליחה להתחבר כרגע. אפשר לכתוב קלוריות בעצמך.",
  busy: "ההערכה החכמה עמוסה. נסו שוב בעוד דקה או כתבו קלוריות בעצמך.",
  failed: "ההערכה החכמה לא הצליחה הפעם. אפשר לכתוב קלוריות בעצמך.",
  limit: "נגמרו ההערכות החכמות להיום. אפשר לכתוב קלוריות בעצמך.",
};

/**
 * The state of one "what did you eat" entry: the text, the foods read from it (live, from the
 * food database, no AI), the user's changes to amounts, and items added for words the database
 * did not know (by the AI, or a number the user typed).
 */
export function useFoodEntry(initialSaved: SavedFood[] = []) {
  const [text, setTextRaw] = useState("");
  const [saved, setSaved] = useState(initialSaved);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [removed, setRemoved] = useState<number[]>([]);
  const [extra, setExtra] = useState<FoodItem[]>([]);
  // The user's own recipes first ("5 טראפלס"), then the food database for the rest. A text
  // that tells how a recipe was made ("הכנתי… יצאו 40") is not read word by word: its foods are
  // the ingredients of the whole recipe, not what was eaten. The recipe calculator counts it.
  const recipeLike = RECIPE_MADE.test(text);
  const mine = useMemo(() => (recipeLike ? { matches: [], rest: text } : matchSaved(text, saved)), [text, saved, recipeLike]);
  const parsed = useMemo(() => {
    const p = parseFood(mine.rest);
    return recipeLike ? { ...p, items: [], unknown: p.unknown.length ? p.unknown : ["מתכון"] } : p;
  }, [mine, recipeLike]);

  const rows: EntryRow[] = useMemo(() => {
    const own: EntryRow[] = mine.matches.map((m, index) => ({ kind: "saved" as const, index, item: savedItem(m) }));
    const base: EntryRow[] = parsed.items.flatMap((it, k) =>
      removed.includes(k) ? [] : [{ kind: "db" as const, index: k, item: qty[k] !== undefined ? withQuantity(it, qty[k]) : it }],
    );
    return [...own, ...base, ...extra.map((item, index) => ({ kind: "extra" as const, index, item }))];
  }, [mine, parsed, qty, removed, extra]);
  const items = rows.map((r) => r.item);

  return {
    text,
    setText(v: string) {
      setTextRaw(v);
      setQty({});
      setRemoved([]);
      setExtra([]);
    },
    parsed,
    rows,
    items,
    kcal: items.reduce((a, i) => a + kcalOf(i), 0),
    /** Words not in the database that nothing was added for yet. */
    unknown: extra.length ? [] : parsed.unknown,
    setQty: (k: number, v: number) => setQty((q) => ({ ...q, [k]: v })),
    remove: (k: number) => setRemoved((r) => [...r, k]),
    addExtra: (list: FoodItem[]) => setExtra((e) => [...e, ...list]),
    removeExtra: (k: number) => setExtra((e) => e.filter((_, i) => i !== k)),
    /** A worked-out recipe stands for the whole text: the foods read from its words step aside. */
    applyRecipe: (list: FoodItem[]) => {
      setRemoved(parsed.items.map((_, k) => k));
      setExtra(list);
    },
    extra,
    saved,
    recipeLike,
    /** A recipe saved (or edited) from the calculator. */
    keepSaved: (f: SavedFood) => setSaved((list) => [f, ...list.filter((x) => x.id !== f.id && x.name !== f.name)]),
    reset() {
      setTextRaw("");
      setQty({});
      setRemoved([]);
      setExtra([]);
    },
  };
}

export type EntryRow = { kind: "db"; index: number; item: ParsedItem } | { kind: "extra" | "saved"; index: number; item: FoodItem };

/** Words that say a whole recipe was made and then shared out. */
const RECIPE_MADE = /(הכנתי|מתכון|יצאו|יצא לי|אפיתי|בישלתי|מהסיר|מתוך התבנית)/;

/** Words that say the meal was cooked and shared out: worth the recipe calculator. */
const RECIPE_HINT = /(הכנתי|מתכון|יצאו|יצא לי|מתוך|כדורים|מהסיר|סיר|תבנית|אפיתי|בישלתי|חבילה|חבילת|חפיסה|חפיסת|צנצנת)/;
export type FoodEntryState = ReturnType<typeof useFoodEntry>;

/**
 * Text box plus the live breakdown: each food with its amount (− / + to change it) and its
 * calories, the total in large type, and a way to count words the database did not know.
 */
export function FoodEntry({
  entry,
  aiEnabled,
  showNumbers,
  placeholder = "למשל: 2 פרוסות לחם מלא עם חביתה, סלט ירקות וקפה הפוך",
  autoFocus = false,
  understand,
  save,
}: {
  entry: FoodEntryState;
  aiEnabled: boolean;
  showNumbers: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Reads a recipe's words; the AI by default. The demo passes its own. */
  understand?: ((text: string) => Promise<UnderstandMealResult>) | null;
  /** Saves "my recipe"; the server by default, none in the demo. */
  save?: SaveFood | null;
}) {
  const read = understand === undefined ? (aiEnabled ? understandFood : null) : understand;
  const keep = save === undefined ? saveFood : save;
  const [calc, setCalc] = useState<{ text: string; edit: SavedFood | null } | null>(null);
  const [manual, setManual] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [asking, startAsk] = useTransition();

  function askAi() {
    const words = entry.unknown.join(", ");
    setNote(null);
    startAsk(async () => {
      const r = await analyzeFood(words).catch(() => ({ ok: false as const, reason: "failed" as const }));
      if (r.ok) entry.addExtra(r.items.map((i) => ({ ...i, item_name: i.item_name.slice(0, 120) })));
      else setNote(AI_MESSAGES[r.reason] ?? AI_MESSAGES.failed);
    });
  }

  function addManual() {
    const kcal = Number(manual);
    if (!Number.isFinite(kcal) || kcal <= 0) return;
    entry.addExtra([
      { item_name: entry.unknown.join(", ").slice(0, 120) || "אחר", quantity: null, unit: null, preparation: null, kcal_min: kcal, kcal_max: kcal, protein_g: null, carbs_g: null, fat_g: null, confidence: "low" },
    ]);
    setManual("");
  }

  const hasText = entry.text.trim().length >= 2;

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={entry.text}
        onChange={(e) => entry.setText(e.target.value)}
        rows={2}
        maxLength={1000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="מה אכלת"
        className="w-full resize-none rounded-xl bg-field px-3 py-2.5 text-base outline-none ring-1 ring-transparent focus:ring-ink/20"
      />

      {!hasText && entry.saved.length ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <BookOpen aria-hidden="true" className="size-3.5" />
            המתכונים שלי:
          </span>
          {entry.saved.slice(0, 8).map((f) => (
            <span key={f.id} className="inline-flex items-center rounded-full bg-field ring-1 ring-line">
              <button type="button" onClick={() => entry.setText(`1 ${f.name}`)} className="min-h-8 cursor-pointer ps-3 pe-1.5">
                {f.name}
              </button>
              {f.recipe && read ? (
                <button type="button" onClick={() => setCalc({ text: f.name, edit: f })} aria-label={`עריכת ${f.name}`} className="flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:text-ink">
                  <Pencil aria-hidden="true" className="size-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {hasText && read && showNumbers && !calc && (RECIPE_HINT.test(entry.text) || entry.unknown.length) ? (
        <button
          type="button"
          onClick={() => setCalc({ text: entry.text, edit: null })}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 self-start rounded-lg bg-surface px-3 text-sm font-medium ring-1 ring-line hover:bg-white"
        >
          <Calculator aria-hidden="true" className="size-4" />
          חישוב מתכון או מאכל ביתי
        </button>
      ) : null}

      {calc && read ? (
        <RecipeCalculator
          key={calc.edit?.id ?? calc.text}
          text={calc.text}
          understand={read}
          save={keep}
          initial={calc.edit}
          onAdd={(items) => (calc.edit ? entry.addExtra(items) : entry.applyRecipe(items))}
          onSaved={entry.keepSaved}
          onClose={() => setCalc(null)}
        />
      ) : null}

      {hasText && entry.items.length ? (
        <div className="flex flex-col rounded-xl bg-accent-soft p-3" aria-live="polite">
          <ul className="flex flex-col divide-y divide-ink/5">
            {entry.rows.map((r) => {
              const it = r.item;
              return (
                <li key={`${r.kind}${r.index}`} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 text-sm leading-snug">
                    {describeItem(it)}
                    {r.kind === "extra" ? <span className="text-xs text-ink-muted"> · הערכה</span> : null}
                    {r.kind === "saved" ? <span className="text-xs text-ink-muted"> · מהמתכונים שלי</span> : null}
                  </span>
                  {r.kind === "db" && r.item.quantity ? (
                    <span className="flex shrink-0 items-center">
                      <Stepper label={`פחות ${it.item_name}`} icon="minus" onClick={() => {
                        const next = (r.item.quantity ?? 0) - stepFor(r.item);
                        if (next > 0) entry.setQty(r.index, next);
                      }} />
                      <Stepper label={`עוד ${it.item_name}`} icon="plus" onClick={() => entry.setQty(r.index, (r.item.quantity ?? 0) + stepFor(r.item))} />
                    </span>
                  ) : null}
                  {showNumbers ? <span className="num w-11 shrink-0 text-end text-sm font-semibold">{kcalOf(it)}</span> : null}
                  <button
                    type="button"
                    onClick={() => (r.kind === "extra" ? entry.removeExtra(r.index) : r.kind === "saved" ? entry.setText(entry.text.replace(r.item.item_name, "").trim()) : entry.remove(r.index))}
                    aria-label={`הסרת ${it.item_name}`}
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-white/70 hover:text-ink"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          {showNumbers ? (
            <div className="mt-1 flex items-baseline justify-between border-t border-ink/10 pt-2">
              <span className="text-sm font-medium">סה״כ בערך</span>
              <span>
                <span className="num text-2xl font-bold">{entry.kcal}</span> <span className="text-sm">קל׳</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasText && entry.unknown.length && !(entry.recipeLike && read) ? (
        <div className="flex flex-col gap-2 rounded-xl bg-field p-3 text-sm">
          <p>
            {entry.recipeLike ? (
              "זה נשמע כמו מתכון שלם. כמה קלוריות היה בחלק שאכלת?"
            ) : (
              <>
                לא מצאתי במאגר: <span className="font-medium">{entry.unknown.join(", ")}</span>
              </>
            )}
          </p>
          {showNumbers ? (
            <div className="flex flex-wrap items-center gap-2">
              {aiEnabled ? (
                <button
                  type="button"
                  onClick={askAi}
                  disabled={asking}
                  className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 font-medium ring-1 ring-line hover:bg-white disabled:opacity-60"
                >
                  {asking ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
                  הערכה חכמה
                </button>
              ) : null}
              <span className="text-ink-muted">{aiEnabled ? "או" : "כמה קלוריות בערך?"}</span>
              <input
                inputMode="numeric"
                dir="ltr"
                value={manual}
                onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && addManual()}
                placeholder="קל׳"
                aria-label="קלוריות משוערות"
                className="num min-h-9 w-20 rounded-lg bg-surface px-2 text-center ring-1 ring-line outline-none focus:ring-ink/30"
              />
              <button type="button" onClick={addManual} disabled={!manual} className="min-h-9 cursor-pointer rounded-lg px-2 font-medium underline underline-offset-4 disabled:opacity-40">
                הוספה
              </button>
            </div>
          ) : null}
          {note ? <p className="text-xs text-ink-muted">{note}</p> : null}
        </div>
      ) : null}

      {hasText && !entry.items.length && !entry.unknown.length ? <p className="text-sm text-ink-muted">כתבו מה אכלתם, למשל &quot;חביתה ו-2 פרוסות לחם&quot;.</p> : null}
    </div>
  );
}

function Stepper({ label, onClick, icon }: { label: string; onClick: () => void; icon: "minus" | "plus" }) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex size-7 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-white/70 hover:text-ink">
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}
