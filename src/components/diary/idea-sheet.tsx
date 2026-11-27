"use client";

import { Check, ChevronRight, Clock, Heart, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { planIdea } from "@/lib/food/diary-actions";
import { IDEA_SIZE_EMOJI, IDEA_SIZE_KCAL, IDEA_SIZE_LABEL, IDEA_SIZES, suggestIdeas, type Idea, type IdeaInput, type IdeaSize, type PlannedIdea } from "@/lib/food/ideas";
import { Sheet } from "./sheet";

const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");
const PAGE = 4;

export type IdeaContext = Omit<IdeaInput, "size" | "seed">;

/**
 * "תן לי רעיון למנה", mounted on open: how big (light, medium, large), then four dishes that
 * fit the user's taste and what is left today, "תן לי עוד רעיונות" for the next ones.
 * Choosing a dish keeps it under "מנות שבחרתי"; nothing is counted until "אכלתי את המנה".
 */
export function IdeaSheet({
  onClose,
  onPlanned,
  context,
  showNumbers,
}: {
  onClose: () => void;
  onPlanned: (planned: PlannedIdea[]) => void;
  context: IdeaContext;
  showNumbers: boolean;
}) {
  const [size, setSize] = useState<IdeaSize | null>(null);
  // Set in the click, so the first render stays the same on the server and in the browser.
  const [seed, setSeed] = useState(1);
  const [page, setPage] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const [picking, setPicking] = useState<string | null>(null);

  const result = useMemo(() => (size ? suggestIdeas({ ...context, size, seed }) : null), [size, seed, context]);
  const pages = result ? Math.max(1, Math.ceil(result.ideas.length / PAGE)) : 1;
  const shown = result ? result.ideas.slice((page % pages) * PAGE, (page % pages) * PAGE + PAGE) : [];

  function choose(i: Idea) {
    setNote(null);
    setPicking(i.slug);
    start(async () => {
      const r = await planIdea({ slug: i.slug, kcal: i.kcal }).catch(() => ({ ok: false, planned: [] }));
      setPicking(null);
      if (!r.ok) {
        setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
        return;
      }
      onPlanned(r.planned);
    });
  }

  return (
    <Sheet open onClose={onClose} title={size ? `רעיון למנה ${IDEA_SIZE_LABEL[size].replace(" (ביניים)", "")}` : "תן לי רעיון למנה"}>
      {!size ? (
        <>
          <p className="text-ink-muted">איזו מנה בא לך?</p>
          <div className="flex flex-col gap-2.5">
            {IDEA_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSize(s);
                  setPage(0);
                  setSeed(Math.floor(Math.random() * 1e9));
                }}
                className="flex min-h-20 cursor-pointer items-center gap-3.5 rounded-2xl bg-surface p-4 text-start shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] hover:bg-white active:scale-[0.99]"
              >
                <span aria-hidden="true" className="text-3xl">
                  {IDEA_SIZE_EMOJI[s]}
                </span>
                <span className="flex flex-col">
                  <span className="text-lg font-semibold">{IDEA_SIZE_LABEL[s]}</span>
                  {showNumbers ? <span className="text-sm text-ink-muted">עד כ-{IDEA_SIZE_KCAL[s]} קלוריות</span> : null}
                </span>
              </button>
            ))}
          </div>
          {showNumbers && context.target !== null ? (
            <p className="text-sm text-ink-muted">
              נשארו לך היום <span className="num font-semibold text-ink">{fmt(Math.max(0, context.target - context.eatenKcal))}</span> קלוריות
              {context.proteinTarget ? (
                <>
                  {" "}
                  ו-<span className="num font-semibold text-ink">{fmt(Math.max(0, context.proteinTarget - context.eatenProtein))}</span> גרם חלבון
                </>
              ) : null}
              .
            </p>
          ) : null}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSize(null)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-full bg-surface px-3 text-sm font-medium ring-1 ring-line hover:bg-field"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
            גודל אחר
          </button>
          {showNumbers && result && result.left !== null && result.left < IDEA_SIZE_KCAL[size] - 20 ? (
            <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm">נשארו לך היום {fmt(Math.max(0, result.left))} קלוריות, אז המנות קצת יותר קטנות.</p>
          ) : null}
          {shown.length ? (
            <ul className="flex flex-col gap-3">
              {shown.map((i) => (
                <IdeaCard key={i.slug} idea={i} showNumbers={showNumbers} busy={saving && picking === i.slug} disabled={saving} onChoose={() => choose(i)} />
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-surface p-4 text-ink-muted">לא מצאתי מנה שמתאימה לכל ההעדפות שלך בגודל הזה. נסו גודל אחר.</p>
          )}
          {result && result.ideas.length > PAGE ? (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface font-medium ring-1 ring-line hover:bg-field"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              תן לי עוד רעיונות
            </button>
          ) : null}
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

function IdeaCard({ idea, showNumbers, busy, disabled, onChoose }: { idea: Idea; showNumbers: boolean; busy: boolean; disabled: boolean; onChoose: () => void }) {
  const m = idea.meal;
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-4xl">
          {idea.emoji}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-lg leading-snug font-semibold">
            {idea.title}
            {idea.liked ? <Heart aria-label="מכיל משהו שאתה אוהב" className="ms-1 inline size-4 fill-coral text-coral" /> : null}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            {showNumbers ? (
              <>
                <span>
                  <span className="num font-semibold text-ink">{fmt(m.kcal)}</span> קלוריות
                </span>
                <span>
                  <span className="num font-semibold text-ink">{fmt(m.protein)}</span> גרם חלבון
                </span>
              </>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="size-3.5" />
              <span className="num">{idea.prepMinutes}</span> דק׳
            </span>
          </span>
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">
        {m.items.map((it) => (
          <li key={it.food + it.name} className="flex justify-between gap-2">
            <span>
              <span className="num font-medium">{it.amount}</span> {it.name}
              {it.hint ? <span className="text-ink-muted"> ({it.hint})</span> : null}
            </span>
            {showNumbers ? <span className="num shrink-0 text-ink-muted">{fmt(it.kcal)}</span> : null}
          </li>
        ))}
      </ul>
      {m.tip ? <p className="text-sm text-ink-muted">{m.tip}</p> : null}
      <button
        type="button"
        onClick={onChoose}
        disabled={disabled}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
        בחרתי את המנה
      </button>
    </li>
  );
}
