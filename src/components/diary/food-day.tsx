"use client";

import { Beef, Check, ChevronLeft, Lightbulb, Loader2, Plus, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { confirmFoodLog } from "@/lib/food/actions";
import { eatPlanned, removePlanned } from "@/lib/food/diary-actions";
import { clockOf, foodsLine, kcalMid, summarize, type DiaryMeal } from "@/lib/food/diary";
import { ideaBySlug, type PlannedIdea } from "@/lib/food/ideas";
import { DIARY_MEALS, groupOf, MEAL_LABEL, totalsOf, type MealType } from "@/lib/food/items";
import { AddMealSheet } from "./add-meal-sheet";
import { EditMealSheet } from "./edit-meal-sheet";
import { IdeaSheet, type IdeaContext } from "./idea-sheet";

const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");

export interface FoodDayProps {
  dateLabel: string;
  isToday: boolean;
  meals: (DiaryMeal & { source?: "web" | "telegram" })[];
  target: number | null;
  proteinTarget: number | null;
  showNumbers: boolean;
  ideaContext: Omit<IdeaContext, "eatenKcal" | "eatenProtein">;
  planned: PlannedIdea[];
  /** Opened from the home screen's buttons. */
  open?: "add" | "idea" | null;
}

/**
 * "יום האוכל שלי": only what the user ate. The day's numbers at the top, the dishes by the meal
 * the user chose, and two actions: "+ הוספת מנה" and "תן לי רעיון למנה". Dishes picked from the
 * ideas wait apart, under "מנות שבחרתי", and count only after "אכלתי את המנה".
 */
export function FoodDay(p: FoodDayProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(p.isToday && p.open === "add");
  const [ideas, setIdeas] = useState(p.isToday && p.open === "idea");
  const [editing, setEditing] = useState<DiaryMeal | null>(null);
  const [planned, setPlanned] = useState(p.planned);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sum = useMemo(() => summarize(p.meals, p.target, p.proteinTarget, { finished: !p.isToday }), [p.meals, p.target, p.proteinTarget, p.isToday]);
  const ideaContext = useMemo(() => ({ ...p.ideaContext, eatenKcal: sum.kcal, eatenProtein: sum.protein }), [p.ideaContext, sum.kcal, sum.protein]);
  const groups = useMemo(
    () =>
      DIARY_MEALS.map((g) => ({ g, meals: p.meals.filter((m) => groupOf(m.mealType) === g).sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1)) })).filter((x) => x.meals.length),
    [p.meals],
  );

  useEffect(() => {
    // "?open=add" from the home screen opens the sheet once, not again on every refresh.
    if (p.open && typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
  }, [p.open]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const done = (msg: string) => {
    setAdding(false);
    setEditing(null);
    setToast(msg);
    router.refresh();
  };

  return (
    <>
      <Header {...p} sum={sum} />

      {p.isToday ? (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-16 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-brand text-xl font-bold text-white shadow-[0_12px_28px_-12px_rgba(18,21,19,0.75)] hover:bg-brand-strong active:scale-[0.98]"
          >
            <Plus aria-hidden="true" className="size-7" strokeWidth={2.75} />
            הוספת מנה
          </button>
          <button
            type="button"
            onClick={() => setIdeas(true)}
            className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface font-medium shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] hover:bg-field active:scale-[0.98]"
          >
            <Lightbulb aria-hidden="true" className="size-5 text-warning" />
            תן לי רעיון למנה
          </button>
        </div>
      ) : null}

      <section aria-label="מה אכלתי" className="flex flex-col gap-4" aria-busy={pending}>
        {!groups.length ? (
          <p className="rounded-[var(--radius-card)] bg-surface p-5 text-center text-lg text-ink-muted shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
            {p.isToday ? "עדיין לא הוספת מנות להיום. מתחילים?" : "לא נרשם אוכל ביום הזה."}
          </p>
        ) : null}
        {groups.map(({ g, meals }) => {
          const kcal = meals.filter((m) => m.status === "confirmed").reduce((a, m) => a + m.items.reduce((x, i) => x + kcalMid(i), 0), 0);
          return (
            <div key={g} className="flex flex-col gap-2">
              <h2 className="flex items-baseline justify-between gap-2 px-1">
                <span className="text-lg font-semibold">{MEAL_LABEL[g]}</span>
                {p.showNumbers && kcal ? (
                  <span className="text-sm text-ink-muted">
                    <span className="num font-semibold text-ink">{fmt(kcal)}</span> קלוריות
                  </span>
                ) : null}
              </h2>
              {meals.map((m) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  showNumbers={p.showNumbers}
                  busy={pending}
                  onEdit={() => setEditing(m)}
                  onConfirm={() =>
                    start(async () => {
                      await confirmFoodLog(m.id);
                      router.refresh();
                    })
                  }
                />
              ))}
            </div>
          );
        })}
      </section>

      {p.isToday && planned.length ? (
        <Planned
          planned={planned}
          context={ideaContext}
          showNumbers={p.showNumbers}
          onChange={setPlanned}
          onEaten={(m) => done(p.showNumbers && m.kcal ? `נוסף ליומן: ${fmt(m.kcal)} קלוריות, ${fmt(m.protein)} גרם חלבון.` : "נוסף ליומן.")}
        />
      ) : null}

      {adding ? (
        <AddMealSheet
          onClose={() => setAdding(false)}
          onAdded={(m) => done(p.showNumbers && m.kcal ? `נוסף ליומן: ${fmt(m.kcal)} קלוריות, ${fmt(m.protein)} גרם חלבון.` : "נוסף ליומן.")}
          showNumbers={p.showNumbers}
        />
      ) : null}
      {editing ? <EditMealSheet key={editing.id} meal={editing} onClose={() => setEditing(null)} onDone={done} showNumbers={p.showNumbers} /> : null}
      {ideas ? (
        <IdeaSheet
          onClose={() => setIdeas(false)}
          onPlanned={(list) => {
            setPlanned(list);
            setIdeas(false);
            setToast("המנה נשמרה ב״מנות שבחרתי״. היא תיספר רק כשתסמן שאכלת.");
          }}
          context={ideaContext}
          showNumbers={p.showNumbers}
        />
      ) : null}

      {toast ? (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5rem)] z-40 mx-auto max-w-md rounded-2xl bg-night px-4 py-3 text-center text-white shadow-[var(--shadow-float)] md:bottom-8"
        >
          {toast}
        </p>
      ) : null}
    </>
  );
}

function MealCard({ meal: m, showNumbers, busy, onEdit, onConfirm }: { meal: DiaryMeal & { source?: "web" | "telegram" }; showNumbers: boolean; busy: boolean; onEdit: () => void; onConfirm: () => void }) {
  const t = totalsOf(m.items);
  const kcal = m.items.reduce((a, i) => a + kcalMid(i), 0);
  const name = dishName(m.text, m.items);
  return (
    <article className="relative">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full cursor-pointer flex-col gap-1.5 rounded-[var(--radius-card)] bg-surface p-4 text-start shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] transition-colors hover:bg-white active:scale-[0.99]"
        aria-label={`${name}, ${clockOf(m.loggedAt)}, לעריכה או מחיקה`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="leading-snug font-semibold">{name}</span>
          <ChevronLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-faint" />
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
          <span className="num">{clockOf(m.loggedAt)}</span>
          <span>·</span>
          <span>{MEAL_LABEL[groupOf(m.mealType)]}</span>
          {m.source === "telegram" ? <Send aria-label="מטלגרם" className="size-3.5" /> : null}
          {m.status === "draft" ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">ממתין לאישור</span> : null}
        </span>
        {showNumbers && m.items.some((i) => i.kcal_min !== null) ? (
          <span className="text-sm text-ink-muted">
            <span className="num text-base font-bold text-ink">{fmt(kcal)}</span> קלוריות
            {" · "}
            <span className="num font-semibold text-ink">{fmt(t.protein ?? 0)}</span> גרם חלבון
          </span>
        ) : null}
      </button>
      {m.status === "draft" ? (
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="absolute end-12 bottom-3 inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg bg-accent-soft px-2.5 text-sm font-medium hover:brightness-95"
        >
          <Check aria-hidden="true" className="size-4" />
          אישור
        </button>
      ) : null}
    </article>
  );
}

/** What the user wrote, when it is short enough to be a name ("חזה עוף ואורז"); else the foods. */
function dishName(text: string, items: DiaryMeal["items"]): string {
  const t = text.replace(/^(אכלתי|היום אכלתי|שתיתי)\s+/, "").replace(/[.\s]+$/, "").trim();
  return t && t.length <= 45 ? t : foodsLine(items) || text;
}

/** "מנות שבחרתי": ideas picked today. Not in the diary and not counted until "אכלתי את המנה". */
function Planned({
  planned,
  context,
  showNumbers,
  onChange,
  onEaten,
}: {
  planned: PlannedIdea[];
  context: IdeaContext;
  showNumbers: boolean;
  onChange: (list: PlannedIdea[]) => void;
  onEaten: (m: { kcal: number; protein: number }) => void;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [, start] = useTransition();
  const refs = useRef(new Map<string, string>());
  const list = planned.flatMap((x) => {
    const idea = ideaBySlug(x.slug, x.kcal, context.profile, context.taste);
    return idea ? [{ x, idea }] : [];
  });
  if (!list.length) return null;

  const eat = (id: string, mealType: MealType, kcal: number, protein: number) => {
    if (!refs.current.has(id)) refs.current.set(id, crypto.randomUUID());
    setBusy(id);
    setNote(null);
    start(async () => {
      const r = await eatPlanned({ id, mealType, clientRef: refs.current.get(id)! }).catch(() => ({ ok: false }));
      setBusy(null);
      if (!r.ok) {
        setNote("לא הצלחתי להוסיף. נסו שוב בעוד רגע.");
        return;
      }
      setAsking(null);
      onChange(planned.filter((p) => p.id !== id));
      onEaten({ kcal, protein });
    });
  };
  const remove = (id: string) => {
    setBusy(id);
    start(async () => {
      const r = await removePlanned(id).catch(() => ({ ok: false, planned }));
      setBusy(null);
      if (r.ok) onChange(r.planned);
    });
  };

  return (
    <section aria-labelledby="planned-title" className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border-2 border-dashed border-line p-3.5">
      <div className="flex flex-col px-1">
        <h2 id="planned-title" className="font-semibold">
          מנות שבחרתי
        </h2>
        <p className="text-sm text-ink-muted">רעיונות בלבד. עוד לא נספרו ביומן.</p>
      </div>
      {list.map(({ x, idea }) => (
        <article key={x.id} className="flex flex-col gap-2.5 rounded-2xl bg-surface p-3.5 ring-1 ring-ink/[0.04]">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl">
              {idea.emoji}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="leading-snug font-semibold">{idea.title}</span>
              {showNumbers ? (
                <span className="text-sm text-ink-muted">
                  <span className="num">{fmt(idea.meal.kcal)}</span> קלוריות · <span className="num">{fmt(idea.meal.protein)}</span> גרם חלבון
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => remove(x.id)}
              disabled={busy === x.id}
              aria-label={`לא אכלתי, להסיר את ${idea.title}`}
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-field hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          {asking === x.id ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">לאיזו ארוחה להוסיף?</p>
              <div className="grid grid-cols-2 gap-2">
                {DIARY_MEALS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={busy === x.id}
                    onClick={() => eat(x.id, m, idea.meal.kcal, idea.meal.protein)}
                    className="min-h-11 cursor-pointer rounded-xl bg-field font-medium hover:bg-line/70 disabled:opacity-50"
                  >
                    {MEAL_LABEL[m]}
                  </button>
                ))}
              </div>
              {busy === x.id ? <Loader2 aria-label="מוסיף" className="size-4 animate-spin self-center" /> : null}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAsking(x.id)}
                className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand font-semibold text-white hover:bg-brand-strong"
              >
                <Check aria-hidden="true" className="size-4" />
                אכלתי את המנה
              </button>
              <button type="button" onClick={() => remove(x.id)} disabled={busy === x.id} className="min-h-11 cursor-pointer rounded-xl px-3 text-sm text-ink-muted hover:bg-field hover:text-ink">
                לא אכלתי
              </button>
            </div>
          )}
        </article>
      ))}
      {note ? (
        <p role="status" className="rounded-xl bg-field px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
    </section>
  );
}

function Header({ dateLabel, target, proteinTarget, showNumbers, sum }: FoodDayProps & { sum: ReturnType<typeof summarize> }) {
  const share = target ? Math.min(1, sum.kcal / target) : 0;
  const over = target !== null && sum.kcal > target;
  const left = target !== null ? target - sum.kcal : null;
  return (
    <section aria-label="יום האוכל שלי" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-night p-4 text-white shadow-[var(--shadow-float)]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">יום האוכל שלי</h2>
        <span className="text-sm text-white/60">{dateLabel}</span>
      </div>
      {showNumbers ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Figure label="נאכלו" value={fmt(sum.kcal)} />
            <Figure label="היעד היומי" value={target ? fmt(target) : "–"} />
            <Figure label={over ? "מעל היעד" : "נותרו"} value={left !== null ? fmt(Math.abs(left)) : "–"} tone={over ? "text-coral" : "text-accent"} />
          </div>
          {target ? (
            <div
              className="h-3 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="קלוריות מהיעד"
              aria-valuenow={Math.round(share * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-coral" : "bg-accent"}`} style={{ width: `${share * 100}%` }} />
            </div>
          ) : null}
          <p className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Beef aria-hidden="true" className="size-4 text-white/60" />
              חלבון: <span className="num font-semibold">{fmt(sum.protein)}</span>
              {proteinTarget ? <span className="num text-white/60">מתוך {proteinTarget} גרם</span> : <span className="text-white/60">גרם</span>}
            </span>
            {proteinTarget ? (
              <span className="h-2 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <span className="block h-full rounded-full bg-sky" style={{ width: `${Math.min(100, (sum.protein / proteinTarget) * 100)}%` }} />
              </span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="text-white/80">
          {sum.meals ? (
            <>
              נרשמו היום <span className="num font-semibold">{sum.meals}</span> מנות.
            </>
          ) : (
            "עוד לא נרשמו מנות היום."
          )}
        </p>
      )}
    </section>
  );
}

function Figure({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <p className="flex flex-col gap-1">
      <span className="text-xs text-white/60">{label}</span>
      <span className={`num text-3xl leading-none font-bold ${tone}`}>{value}</span>
    </p>
  );
}
