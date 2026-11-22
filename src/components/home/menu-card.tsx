"use client";

import { Check, ChevronDown, Loader2, Pencil, RefreshCw, Shuffle, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { analyzeFood } from "@/lib/food/actions";
import { totalsOf, type FoodItem } from "@/lib/food/items";
import { logOtherFood, setMealEaten, swapMeal, swapWholeMenu, type MenuResult } from "@/lib/menu/actions";
import type { MenuView, SlotView } from "@/lib/menu/view";
import { fmt, useDay } from "./day-context";

const SLOT_DOT: Record<SlotView["type"], string> = {
  breakfast: "bg-accent",
  snack: "bg-sand-soft ring-1 ring-ink/10",
  lunch: "bg-coral",
  dinner: "bg-sky",
};

/**
 * The day's menu: one row per meal with its calories, a tap opens the portions, and each meal
 * can be swapped for another of the same calories, or the whole menu at once. "Ate it" logs the
 * meal; "I ate something else" takes free text and estimates it.
 */
export function MenuCard({ initial, showNumbers, saved, aiEnabled }: { initial: MenuView; showNumbers: boolean; saved: boolean; aiEnabled: boolean }) {
  const { setEatenKcal } = useDay();
  const [menu, setMenu] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [other, setOther] = useState(false);
  const [, start] = useTransition();

  function apply(key: string, call: () => Promise<MenuResult>, optimistic?: (m: MenuView) => MenuView) {
    const prev = menu;
    if (optimistic) setMenu(optimistic(menu));
    setBusy(key);
    setError(false);
    start(async () => {
      const r = await call().catch((): MenuResult => ({ ok: false }));
      setBusy(null);
      if (r.ok) {
        setMenu(r.menu);
        setEatenKcal(r.eatenKcal);
      } else {
        setMenu(prev);
        setError(true);
      }
    });
  }

  const eatenCount = menu.slots.filter((s) => s.eaten).length;

  return (
    <section aria-labelledby="menu-title" className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <h2 id="menu-title" className="text-lg font-semibold">
            התפריט של היום
          </h2>
          <span className="text-xs text-ink-muted">
            {showNumbers ? (
              <>
                <span className="num">{fmt(menu.planned)}</span> קל׳ · {eatenCount}/{menu.slots.length} ארוחות
              </>
            ) : (
              <>
                {eatenCount}/{menu.slots.length} ארוחות
              </>
            )}
          </span>
        </div>
        {saved ? (
          <button
            type="button"
            onClick={() => apply("all", swapWholeMenu)}
            disabled={busy !== null || eatenCount === menu.slots.length}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-field px-3 text-sm font-medium transition-colors hover:bg-line/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${busy === "all" ? "animate-spin" : ""}`} />
            תפריט אחר
          </button>
        ) : null}
      </header>

      {!saved ? (
        <p className="mx-4 mb-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
          התפריט מוצג לדוגמה. כדי לשמור, להחליף ולסמן ארוחות צריך להריץ פעם אחת את עדכון מסד הנתונים.
        </p>
      ) : null}

      <ul className="flex flex-col">
        {menu.slots.map((s) => (
          <MealRow
            key={s.index}
            slot={s}
            open={open === s.index}
            onToggle={() => setOpen(open === s.index ? null : s.index)}
            showNumbers={showNumbers}
            saved={saved}
            busy={busy}
            onEat={() =>
              apply(`eat:${s.index}`, () => setMealEaten(s.index, !s.eaten), (m) => ({
                ...m,
                slots: m.slots.map((x) => (x.index === s.index ? { ...x, eaten: !x.eaten, instead: x.eaten ? null : x.instead } : x)),
              }))
            }
            onSwap={() => apply(`swap:${s.index}`, () => swapMeal(s.index))}
          />
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mx-4 mb-2 text-sm text-warning">
          לא הצלחנו לשמור. נסו שוב.
        </p>
      ) : null}

      <div className="border-t border-line px-4 py-3">
        {other ? (
          <OtherFood
            slots={menu.slots.filter((s) => !s.eaten)}
            aiEnabled={aiEnabled}
            showNumbers={showNumbers}
            saved={saved}
            onClose={() => setOther(false)}
            onSaved={(r) => {
              setMenu(r.menu);
              setEatenKcal(r.eatenKcal);
              setOther(false);
            }}
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOther(true)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-1 text-sm font-medium text-ink transition-colors hover:text-ink-muted"
            >
              <Pencil aria-hidden="true" className="size-4" />
              אכלתי משהו אחר
            </button>
            <Link href="/food" className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
              יומן האוכל
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function MealRow({
  slot: s,
  open,
  onToggle,
  showNumbers,
  saved,
  busy,
  onEat,
  onSwap,
}: {
  slot: SlotView;
  open: boolean;
  onToggle: () => void;
  showNumbers: boolean;
  saved: boolean;
  busy: string | null;
  onEat: () => void;
  onSwap: () => void;
}) {
  const panel = `meal-${s.index}`;
  const swapping = busy === `swap:${s.index}`;
  const title = s.instead ? s.instead.text : (s.meal?.title ?? "");
  return (
    <li className="border-t border-line first:border-t-0">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onEat}
          disabled={!saved || busy !== null}
          aria-pressed={s.eaten}
          aria-label={s.eaten ? `ביטול: אכלתי ${s.label}` : `אכלתי ${s.label}`}
          className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] active:scale-95 disabled:cursor-default ${
            s.eaten ? "border-brand bg-brand text-accent" : "border-line text-transparent hover:border-ink/40 hover:text-ink/30"
          }`}
        >
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        </button>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panel} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className={`size-1.5 rounded-full ${SLOT_DOT[s.type]}`} aria-hidden="true" />
              {s.label}
              {s.instead ? <span className="rounded-full bg-field px-1.5 text-[10px]">אכלתי משהו אחר</span> : null}
            </span>
            <span className={`truncate text-[15px] leading-snug font-medium ${s.eaten ? "text-ink-muted" : ""}`}>{title}</span>
          </span>
          {showNumbers ? (
            <span className="flex shrink-0 flex-col items-end leading-none">
              <span className="num text-base font-semibold">{s.instead ? (s.instead.kcal ?? "–") : s.kcal}</span>
              <span className="text-[10px] text-ink-muted">קל׳</span>
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {saved && !s.eaten ? (
          <button
            type="button"
            onClick={onSwap}
            disabled={busy !== null}
            aria-label={`החלפת ${s.label} באפשרות אחרת`}
            title="החלפה באפשרות אחרת באותן קלוריות"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-field hover:text-ink disabled:opacity-50"
          >
            <Shuffle aria-hidden="true" className={`size-4 ${swapping ? "animate-pulse" : ""}`} />
          </button>
        ) : (
          <span className="size-9 shrink-0" aria-hidden="true" />
        )}
      </div>

      {open && s.meal && !s.instead ? (
        <div id={panel} className="mx-3 mb-3 flex flex-col gap-2 rounded-xl bg-field p-3">
          <ul className="flex flex-col gap-1.5 text-sm">
            {s.meal.items.map((it) => (
              <li key={it.food} className="flex items-baseline justify-between gap-3">
                <span>
                  <span className="num font-semibold">{it.amount}</span> {it.name}
                  {it.hint ? <span className="text-ink-muted"> ({it.hint})</span> : null}
                </span>
                {showNumbers ? (
                  <span className="num shrink-0 text-xs text-ink-muted">{it.kcal}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {s.meal.tip ? <p className="text-xs text-ink-muted">{s.meal.tip}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs text-ink-muted">
            {showNumbers ? (
              <span>
                חלבון <span className="num font-medium text-ink">{s.meal.protein}</span> ג׳ · פחמימות <span className="num font-medium text-ink">{s.meal.carbs}</span> ג׳ · שומן{" "}
                <span className="num font-medium text-ink">{s.meal.fat}</span> ג׳
              </span>
            ) : (
              <span />
            )}
            {s.option.of > 1 ? (
              <span>
                אפשרות <span className="num">{s.option.at}</span> מתוך <span className="num">{s.option.of}</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {open && s.instead ? (
        <p id={panel} className="mx-3 mb-3 rounded-xl bg-field p-3 text-sm">
          במקום {s.meal?.title}: {s.instead.text}. לביטול מסירים את הסימון.
        </p>
      ) : null}
    </li>
  );
}

const MESSAGES: Record<string, string> = {
  no_key: "ההערכה האוטומטית עוד לא הופעלה. אפשר לכתוב קלוריות משוערות בעצמך.",
  not_food: "לא זיהיתי כאן אוכל. נסו למשל: \"2 פרוסות פיצה ופחית קולה\".",
  bad_key: "ההערכה האוטומטית לא מצליחה להתחבר כרגע. אפשר לכתוב קלוריות משוערות בעצמך.",
  busy: "שירות ההערכה עמוס. נסו שוב בעוד דקה, או כתבו קלוריות בעצמך.",
  failed: "לא הצלחתי להעריך הפעם. נסו שוב או כתבו קלוריות בעצמך.",
  limit: "הגעת למספר ההערכות להיום. אפשר לכתוב קלוריות בעצמך.",
};

function OtherFood({
  slots,
  aiEnabled,
  showNumbers,
  saved,
  onClose,
  onSaved,
}: {
  slots: SlotView[];
  aiEnabled: boolean;
  showNumbers: boolean;
  saved: boolean;
  onClose: () => void;
  onSaved: (r: Extract<MenuResult, { ok: true }>) => void;
}) {
  const [text, setText] = useState("");
  const [slot, setSlot] = useState<number | null>(slots[0]?.index ?? null);
  const [items, setItems] = useState<FoodItem[] | null>(null);
  const [manual, setManual] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();
  const ref = useRef<string | null>(null);

  const totals = items ? totalsOf(items) : null;
  const mid = totals?.kcal ? Math.round((totals.kcal[0] + totals.kcal[1]) / 2) : null;

  function estimate() {
    setNote(null);
    startAnalyze(async () => {
      const r = await analyzeFood(text).catch(() => ({ ok: false as const, reason: "failed" as const }));
      if (r.ok) setItems(r.items);
      else {
        setItems(null);
        setNote(MESSAGES[r.reason] ?? MESSAGES.failed);
      }
    });
  }

  function save() {
    ref.current ??= crypto.randomUUID();
    const kcal = Number(manual);
    const list: FoodItem[] =
      items ??
      (showNumbers && manual && Number.isFinite(kcal) && kcal > 0
        ? [{ item_name: text.slice(0, 120), quantity: null, unit: null, preparation: null, kcal_min: Math.round(kcal), kcal_max: Math.round(kcal), protein_g: null, carbs_g: null, fat_g: null, confidence: "low" }]
        : []);
    const clientRef = ref.current;
    setNote(null);
    startSave(async () => {
      const r = await logOtherFood({ text, items: list, estimated: Boolean(items), slot, clientRef }).catch((): MenuResult => ({ ok: false }));
      if (r.ok) onSaved(r);
      else setNote("השמירה לא הצליחה. נסו שוב.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">מה אכלת?</span>
        <button type="button" onClick={onClose} aria-label="סגירה" className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-field">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setItems(null);
        }}
        rows={2}
        maxLength={1000}
        placeholder="למשל: שתי פרוסות פיצה ופחית קולה זירו"
        className="w-full resize-none rounded-xl bg-field px-3 py-2.5 text-base outline-none ring-1 ring-transparent focus:ring-ink/20"
      />
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="mb-1.5 text-xs text-ink-muted">במקום איזו ארוחה?</legend>
        {slots.map((s) => (
          <button
            key={s.index}
            type="button"
            onClick={() => setSlot(s.index)}
            aria-pressed={slot === s.index}
            className={`min-h-8 cursor-pointer rounded-full px-3 text-sm transition-colors ${slot === s.index ? "bg-brand text-white" : "bg-field hover:bg-line/60"}`}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSlot(null)}
          aria-pressed={slot === null}
          className={`min-h-8 cursor-pointer rounded-full px-3 text-sm transition-colors ${slot === null ? "bg-brand text-white" : "bg-field hover:bg-line/60"}`}
        >
          תוספת לתפריט
        </button>
      </fieldset>

      {showNumbers && aiEnabled ? (
        <button
          type="button"
          onClick={estimate}
          disabled={analyzing || text.trim().length < 2}
          className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-xl bg-field px-3 text-sm font-medium transition-colors hover:bg-line/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzing ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
          כמה קלוריות זה?
        </button>
      ) : null}

      {items && showNumbers ? (
        <div className="flex flex-col gap-1 rounded-xl bg-accent-soft p-3 text-sm">
          {items.map((i, k) => (
            <div key={k} className="flex justify-between gap-2">
              <span>
                {i.quantity ? <span className="num">{i.quantity} </span> : null}
                {i.unit ? `${i.unit} ` : ""}
                {i.item_name}
              </span>
              <span className="num shrink-0 text-ink-muted">{i.kcal_min === i.kcal_max ? i.kcal_min : `${i.kcal_min}–${i.kcal_max}`}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-ink/10 pt-1 font-semibold">
            <span>בערך</span>
            <span className="num">{mid ?? "–"} קל׳</span>
          </div>
        </div>
      ) : null}

      {!items && showNumbers ? (
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          {aiEnabled ? "או כתבו בעצמכם:" : "קלוריות משוערות:"}
          <input
            inputMode="numeric"
            dir="ltr"
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            placeholder="450"
            className="num min-h-9 w-24 rounded-lg bg-field px-3 text-center text-ink outline-none ring-1 ring-transparent focus:ring-ink/20"
          />
        </label>
      ) : null}

      {note ? (
        <p role="status" className="text-sm text-ink-muted">
          {note}
        </p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={!saved || saving || text.trim().length < 2}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
        הוספה ליומן
      </button>
    </div>
  );
}
