"use client";

import { Check, ChevronDown, Feather, List, Loader2, Minus, Pencil, Plus, RefreshCw, Shuffle, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { FoodEntry, useFoodEntry } from "@/components/food/food-entry";
import { chooseMeal, logOtherFood, setMealEaten, setSlotKcal, swapMeal, swapWholeMenu, type MenuResult } from "@/lib/menu/actions";
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
/** What the card does on a tap. The app uses the server actions; the demo passes local ones. */
export interface MenuApi {
  eat: (index: number, eaten: boolean) => Promise<MenuResult>;
  swap: (index: number) => Promise<MenuResult>;
  swapAll: () => Promise<MenuResult>;
  other: (input: Parameters<typeof logOtherFood>[0]) => Promise<MenuResult>;
  choose: (index: number, slug: string) => Promise<MenuResult>;
  setKcal: (index: number, kcal: number | null) => Promise<MenuResult>;
}

const SERVER_API: MenuApi = { eat: setMealEaten, swap: swapMeal, swapAll: swapWholeMenu, other: logOtherFood, choose: chooseMeal, setKcal: setSlotKcal };

export function MenuCard({
  initial,
  showNumbers,
  saved,
  aiEnabled,
  api = SERVER_API,
}: {
  initial: MenuView;
  showNumbers: boolean;
  saved: boolean;
  aiEnabled: boolean;
  api?: MenuApi;
}) {
  const { setEatenKcal, setEatenProtein } = useDay();
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
        setEatenProtein(r.eatenProtein);
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
                מסתכם ל-<span className="num">{fmt(menu.planned)}</span> קל׳ · {eatenCount}/{menu.slots.length} ארוחות
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
            onClick={() => apply("all", api.swapAll)}
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
              apply(`eat:${s.index}`, () => api.eat(s.index, !s.eaten), (m) => ({
                ...m,
                slots: m.slots.map((x) => (x.index === s.index ? { ...x, eaten: !x.eaten, instead: x.eaten ? null : x.instead } : x)),
              }))
            }
            onSwap={() => apply(`swap:${s.index}`, () => api.swap(s.index))}
            onChoose={(slug) => apply(`swap:${s.index}`, () => api.choose(s.index, slug))}
            onKcal={(kcal) => apply(`kcal:${s.index}`, () => api.setKcal(s.index, kcal))}
            canFixKcal={menu.slots.filter((x) => x.custom).length < menu.slots.length - 1 || s.custom}
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
            onLog={api.other}
            onClose={() => setOther(false)}
            onSaved={(r) => {
              setMenu(r.menu);
              setEatenKcal(r.eatenKcal);
              setEatenProtein(r.eatenProtein);
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
  onChoose,
  onKcal,
  canFixKcal,
}: {
  slot: SlotView;
  open: boolean;
  onToggle: () => void;
  showNumbers: boolean;
  saved: boolean;
  busy: string | null;
  onEat: () => void;
  onSwap: () => void;
  onChoose: (slug: string) => void;
  onKcal: (kcal: number | null) => void;
  canFixKcal: boolean;
}) {
  const [tool, setTool] = useState<"list" | "kcal" | null>(null);
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
              {s.light && !s.instead ? <span className="rounded-full bg-accent-soft px-1.5 text-[10px] text-ink">קליל</span> : null}
              {s.custom && showNumbers ? <span className="rounded-full bg-sky-soft px-1.5 text-[10px] text-ink">כ-{s.planned} קל׳ לפי בחירתך</span> : null}
            </span>
            <span className={`truncate text-[15px] leading-snug font-medium ${s.eaten ? "text-ink-muted" : ""}`}>{title}</span>
            {s.meal && !s.instead && !open ? (
              <span className="truncate text-xs text-ink-muted">{s.meal.items.map((it) => `${it.amount} ${it.name}`).join(" · ")}</span>
            ) : null}
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
          {saved && !s.eaten ? (
            <div className="flex flex-wrap gap-1.5 border-t border-line pt-2">
              <button
                type="button"
                onClick={() => setTool(tool === "list" ? null : "list")}
                aria-expanded={tool === "list"}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${tool === "list" ? "bg-brand text-white" : "bg-surface hover:bg-line/60"}`}
              >
                <List aria-hidden="true" className="size-4" />
                כל האפשרויות ({s.choices.length})
              </button>
              {showNumbers && (canFixKcal || s.custom) ? (
                <button
                  type="button"
                  onClick={() => setTool(tool === "kcal" ? null : "kcal")}
                  aria-expanded={tool === "kcal"}
                  className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${tool === "kcal" ? "bg-brand text-white" : "bg-surface hover:bg-line/60"}`}
                >
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  כמה קלוריות לארוחה
                </button>
              ) : null}
            </div>
          ) : null}
          {tool === "list" ? <ChoiceList slot={s} showNumbers={showNumbers} busy={busy !== null} onChoose={(slug) => { setTool(null); onChoose(slug); }} /> : null}
          {tool === "kcal" ? <KcalEditor slot={s} busy={busy !== null} onSave={(k) => { setTool(null); onKcal(k); }} /> : null}
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

function OtherFood({
  slots,
  aiEnabled,
  showNumbers,
  saved,
  onLog,
  onClose,
  onSaved,
}: {
  slots: SlotView[];
  aiEnabled: boolean;
  showNumbers: boolean;
  saved: boolean;
  onLog: MenuApi["other"];
  onClose: () => void;
  onSaved: (r: Extract<MenuResult, { ok: true }>) => void;
}) {
  const entry = useFoodEntry();
  const [slot, setSlot] = useState<number | null>(slots[0]?.index ?? null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const ref = useRef<string | null>(null);
  const chosen = slots.find((s) => s.index === slot) ?? null;

  function save() {
    ref.current ??= crypto.randomUUID();
    const clientRef = ref.current;
    setNote(null);
    startSave(async () => {
      const r = await onLog({ text: entry.text, items: entry.items, estimated: entry.items.length > 0, slot, clientRef }).catch((): MenuResult => ({ ok: false }));
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
      <FoodEntry entry={entry} aiEnabled={aiEnabled} showNumbers={showNumbers} autoFocus placeholder="למשל: 2 פרוסות לחם עם חביתה וקפה הפוך" />
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
          תוספת מעבר לתפריט
        </button>
      </fieldset>
      {showNumbers && chosen && entry.kcal > 0 ? (
        <p className="text-xs text-ink-muted">
          בתפריט היו כאן <span className="num">{chosen.kcal}</span> קל׳.{" "}
          {entry.kcal > chosen.kcal + 50 ? (
            <>
              זה בערך <span className="num">{entry.kcal - chosen.kcal}</span> קל׳ יותר.
            </>
          ) : entry.kcal < chosen.kcal - 50 ? (
            <>
              זה בערך <span className="num">{chosen.kcal - entry.kcal}</span> קל׳ פחות.
            </>
          ) : (
            "בערך אותו דבר."
          )}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="text-sm text-warning">
          {note}
        </p>
      ) : null}
      <button
        type="button"
        onClick={save}
        disabled={!saved || saving || entry.text.trim().length < 2}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 font-medium text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
        {showNumbers && entry.kcal ? (
          <>
            הוספה ליומן · <span className="num">{entry.kcal}</span> קל׳
          </>
        ) : (
          "הוספה ליומן"
        )}
      </button>
    </div>
  );
}

/** Every meal that can go in the slot, at the slot's calories: tap one to put it in the menu. */
function ChoiceList({ slot, showNumbers, busy, onChoose }: { slot: SlotView; showNumbers: boolean; busy: boolean; onChoose: (slug: string) => void }) {
  const [onlyLight, setOnlyLight] = useState(false);
  const hasLight = slot.choices.some((c) => c.light);
  const list = onlyLight ? slot.choices.filter((c) => c.light) : slot.choices;
  return (
    <div className="flex flex-col gap-2">
      {hasLight ? (
        <button
          type="button"
          onClick={() => setOnlyLight(!onlyLight)}
          aria-pressed={onlyLight}
          className={`inline-flex w-fit min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${onlyLight ? "bg-brand text-white" : "bg-surface ring-1 ring-line hover:bg-line/60"}`}
        >
          <Feather aria-hidden="true" className="size-3.5" />
          רק קלילות
        </button>
      ) : null}
      <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto overscroll-contain pe-0.5">
        {list.map((c) => {
          const current = c.slug === slot.meal?.slug;
          return (
            <li key={c.slug}>
              <button
                type="button"
                disabled={busy || current}
                onClick={() => onChoose(c.slug)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors disabled:cursor-default ${current ? "bg-accent-soft ring-1 ring-accent" : "bg-surface hover:bg-line/40"}`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{c.title}</span>
                    {c.light ? <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[10px]">קליל</span> : null}
                    {current ? <span className="shrink-0 text-[10px] text-ink-muted">בתפריט עכשיו</span> : null}
                  </span>
                  <span className="truncate text-xs text-ink-muted">{c.portions}</span>
                </span>
                {showNumbers ? (
                  <span className="flex shrink-0 flex-col items-end leading-none">
                    <span className="num text-sm font-semibold">{c.kcal}</span>
                    <span className="text-[10px] text-ink-muted">חלבון {c.protein} ג׳</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Roughly how many calories this meal should have. The other meals share the rest of the day. */
function KcalEditor({ slot, busy, onSave }: { slot: SlotView; busy: boolean; onSave: (kcal: number | null) => void }) {
  const [kcal, setKcal] = useState(Math.round(slot.planned / 10) * 10);
  const step = slot.type === "snack" ? 25 : 50;
  const presets = slot.type === "snack" ? [100, 150, 200, 250] : [250, 350, 450, 600];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-surface p-3">
      <span className="text-sm font-medium">כמה קלוריות בערך ל{slot.label}?</span>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setKcal((k) => Math.max(80, k - step))}
          aria-label="פחות"
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-field hover:bg-line/60"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <span className="min-w-24 text-center">
          <span className="num text-2xl font-semibold">{kcal}</span> <span className="text-sm text-ink-muted">קל׳</span>
        </span>
        <button
          type="button"
          onClick={() => setKcal((k) => Math.min(1500, k + step))}
          aria-label="יותר"
          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-field hover:bg-line/60"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setKcal(p)}
            aria-pressed={kcal === p}
            className={`num min-h-8 cursor-pointer rounded-full px-3 text-sm transition-colors ${kcal === p ? "bg-brand text-white" : "bg-field hover:bg-line/60"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted">שאר הארוחות יתחלקו במה שנשאר מהיעד היומי, והבחירה תישמר גם לימים הבאים.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(kcal)}
          className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
        >
          <Check aria-hidden="true" className="size-4" />
          שמירה
        </button>
        {slot.custom ? (
          <button type="button" disabled={busy} onClick={() => onSave(null)} className="min-h-10 cursor-pointer rounded-xl bg-field px-3 text-sm hover:bg-line/60 disabled:opacity-50">
            חזרה לחלוקה הרגילה
          </button>
        ) : null}
      </div>
    </div>
  );
}
