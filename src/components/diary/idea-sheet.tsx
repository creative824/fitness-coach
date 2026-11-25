"use client";

import { Bookmark, BookmarkCheck, Check, ChevronRight, Clock, Heart, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { eatIdea, toggleSavedIdea } from "@/lib/food/diary-actions";
import {
  IDEA_KIND_EMOJI,
  IDEA_KIND_LABEL,
  IDEA_KINDS,
  ideaBySlug,
  SIZE_LABEL,
  SIZES,
  suggestIdeas,
  type Idea,
  type IdeaInput,
  type IdeaKind,
  type Size,
} from "@/lib/food/ideas";
import { Sheet } from "./sheet";

const fmt = (n: number) => Math.round(n).toLocaleString("he-IL");

export type IdeaContext = Omit<IdeaInput, "kind" | "seed">;

/**
 * "תן לי רעיון לארוחה": pick what you are after, get three ideas that fit your taste and what is
 * left today, swap any one for another, choose one to see its portions. Nothing is counted until
 * "אכלתי את זה".
 */
export function IdeaSheet({
  open,
  onClose,
  onEaten,
  context,
  saved: initialSaved,
  showNumbers,
}: {
  open: boolean;
  onClose: () => void;
  onEaten: (msg: string) => void;
  context: IdeaContext;
  saved: string[];
  showNumbers: boolean;
}) {
  const [kind, setKind] = useState<IdeaKind | null>(null);
  // Set on each choice (in the click), so the server render stays stable.
  const [seed, setSeed] = useState(1);
  const [skip, setSkip] = useState<string[]>([]);
  const [chosen, setChosen] = useState<{ idea: Idea; kind: IdeaKind } | null>(null);
  const [saved, setSaved] = useState(initialSaved);

  const all = useMemo(() => (kind ? suggestIdeas({ ...context, kind, seed }) : []), [kind, seed, context]);
  const shown = useMemo(() => {
    const left = all.filter((i) => !skip.includes(i.slug));
    return left.slice(0, 3);
  }, [all, skip]);
  // A saved idea is sized as the meal of this time of day.
  const nowKind: IdeaKind = context.minutes < 11 * 60 ? "breakfast" : context.minutes < 17 * 60 ? "lunch" : "dinner";
  const savedIdeas = useMemo(
    () =>
      saved.flatMap((slug) => {
        const i = ideaBySlug(slug, { ...context, kind: nowKind });
        return i ? [i] : [];
      }),
    [saved, context, nowKind],
  );

  function close() {
    setKind(null);
    setChosen(null);
    setSkip([]);
    onClose();
  }

  const left = context.target !== null ? context.target - context.eatenKcal : null;
  const proteinLeft = context.proteinTarget !== null ? Math.max(0, Math.round(context.proteinTarget - context.eatenProtein)) : null;

  return (
    <Sheet open={open} onClose={close} title={chosen ? chosen.idea.title : kind ? IDEA_KIND_LABEL[kind] : "תן לי רעיון לארוחה"}>
      {chosen ? (
        <Chosen
          idea={chosen.idea}
          kind={chosen.kind}
          left={left}
          showNumbers={showNumbers}
          isSaved={saved.includes(chosen.idea.slug)}
          onBack={() => setChosen(null)}
          onSaved={setSaved}
          onEaten={(m) => {
            close();
            onEaten(m);
          }}
        />
      ) : !kind ? (
        <>
          <p className="text-ink-muted">איזו ארוחה מחפשים?</p>
          <div className="grid grid-cols-2 gap-2.5">
            {IDEA_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setSkip([]);
                  setSeed(Math.floor(Math.random() * 1e9));
                }}
                className="flex min-h-20 cursor-pointer flex-col items-start justify-between gap-1 rounded-2xl bg-surface p-3.5 text-start shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04] hover:bg-field"
              >
                <span className="text-2xl" aria-hidden="true">
                  {IDEA_KIND_EMOJI[k]}
                </span>
                <span className="font-semibold leading-tight">{IDEA_KIND_LABEL[k]}</span>
              </button>
            ))}
          </div>
          {savedIdeas.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-ink-muted">רעיונות ששמרתי</h3>
              <ul className="flex flex-wrap gap-1.5">
                {savedIdeas.map((i) => (
                  <li key={i.slug}>
                    <button
                      type="button"
                      onClick={() => setChosen({ idea: i, kind: nowKind })}
                      className="min-h-10 cursor-pointer rounded-full bg-surface px-3 text-sm ring-1 ring-line hover:bg-field"
                    >
                      <span aria-hidden="true">{i.emoji}</span> {i.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setKind(null)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-lg text-sm text-ink-muted hover:text-ink"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
            סוג ארוחה אחר
          </button>
          {showNumbers && left !== null ? (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
              {left > 0 ? (
                <>
                  נותרו לך היום <span className="num font-semibold">{fmt(left)}</span> קלוריות
                </>
              ) : (
                <>הגעת היום ליעד הקלורי, אז ההצעות קלילות</>
              )}
              {proteinLeft ? (
                <>
                  {" "}
                  ו-<span className="num font-semibold">{proteinLeft}</span> גרם חלבון
                </>
              ) : null}
              .
            </p>
          ) : null}
          {shown.length ? (
            <ul className="flex flex-col gap-3">
              {shown.map((idea) => (
                <IdeaCard
                  key={idea.slug}
                  idea={idea}
                  showNumbers={showNumbers}
                  onChoose={() => setChosen({ idea, kind })}
                  onOther={() => setSkip((s) => [...s, idea.slug])}
                />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-4 ring-1 ring-line">
              <p>{all.length ? "אלה היו כל הרעיונות שמתאימים לך כאן." : "לא מצאתי רעיון שמתאים להעדפות שלך בסוג הזה."}</p>
              {all.length ? (
                <button
                  type="button"
                  onClick={() => setSkip([])}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-field px-3 font-medium hover:bg-line/60"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  להתחיל מההתחלה
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function IdeaCard({ idea, showNumbers, onChoose, onOther }: { idea: Idea; showNumbers: boolean; onChoose: () => void; onOther: () => void }) {
  const m = idea.sizes[idea.suggested];
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-sand-soft text-4xl">
          {idea.emoji}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-semibold leading-snug">{idea.title}</h3>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm text-ink-muted">
            {showNumbers ? (
              <>
                <span>
                  <span className="num font-semibold text-ink">{fmt(m.kcal)}</span> קל׳
                </span>
                <span>
                  <span className="num font-semibold text-ink">{m.protein}</span> ג׳ חלבון
                </span>
              </>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="size-3.5" />
              <span className="num">{idea.prepMinutes}</span> דק׳
            </span>
            {idea.liked ? (
              <span className="inline-flex items-center gap-1 text-coral">
                <Heart aria-hidden="true" className="size-3.5 fill-current" />
                אוהבים
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onChoose} className="min-h-11 flex-1 cursor-pointer rounded-xl bg-brand font-medium text-white hover:bg-brand-strong">
          בחר את הארוחה
        </button>
        <button
          type="button"
          onClick={onOther}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-field px-3 font-medium hover:bg-line/60"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          תן לי משהו אחר
        </button>
      </div>
    </li>
  );
}

function Chosen({
  idea,
  kind,
  left,
  showNumbers,
  isSaved,
  onBack,
  onSaved,
  onEaten,
}: {
  idea: Idea;
  kind: IdeaKind;
  left: number | null;
  showNumbers: boolean;
  isSaved: boolean;
  onBack: () => void;
  onSaved: (s: string[]) => void;
  onEaten: (msg: string) => void;
}) {
  const [size, setSize] = useState<Size>(idea.suggested);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();
  // Made on the first tap and kept for retries, so a repeated tap is not stored twice.
  const ref = useRef<string | null>(null);
  const m = idea.sizes[size];

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-lg text-sm text-ink-muted hover:text-ink"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        לרעיונות
      </button>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-sand-soft text-5xl">
          {idea.emoji}
        </span>
        <p className="flex flex-col text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="size-3.5" />
            הכנה: כ-<span className="num">{idea.prepMinutes}</span> דקות
          </span>
          {m.tip ? <span>{m.tip}</span> : null}
        </p>
      </div>

      <div role="radiogroup" aria-label="גודל מנה" className="grid grid-cols-3 gap-1 rounded-xl bg-field p-1">
        {SIZES.map((s) => {
          const over = left !== null && idea.sizes[s].kcal > left + 50;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={size === s}
              onClick={() => setSize(s)}
              className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-lg text-sm leading-tight ${size === s ? "bg-surface font-semibold shadow-[var(--shadow-card)]" : "text-ink-muted"}`}
            >
              {SIZE_LABEL[s]}
              {showNumbers ? <span className={`num text-xs ${over ? "text-coral" : ""}`}>{fmt(idea.sizes[s].kcal)} קל׳</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-ink/[0.04]">
        <h3 className="text-sm font-medium text-ink-muted">מרכיבים וכמויות</h3>
        <ul className="flex flex-col divide-y divide-ink/5">
          {m.items.map((it) => (
            <li key={it.food} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
              <span>
                {it.amount} {it.name}
                {it.hint ? <span className="text-sm text-ink-muted"> ({it.hint})</span> : null}
              </span>
              {showNumbers ? <span className="num shrink-0 text-sm text-ink-muted">{it.kcal} קל׳</span> : null}
            </li>
          ))}
        </ul>
        {showNumbers ? (
          <div className="flex items-baseline justify-between border-t border-ink/10 pt-2">
            <span>
              <span className="num text-2xl font-bold">{fmt(m.kcal)}</span> קלוריות
            </span>
            <span className="text-sm">
              חלבון <span className="num font-semibold">{m.protein}</span> גרם
            </span>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-ink-muted">זה רק רעיון: הוא נכנס ליומן רק אחרי שתאשרו שאכלתם אותו.</p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              ref.current ??= crypto.randomUUID();
              const r = await eatIdea({ slug: idea.slug, kind, size, clientRef: ref.current }).catch(() => ({ ok: false }));
              if (r.ok) onEaten(showNumbers ? `נוסף ליומן: ${fmt(m.kcal)} קלוריות, ${m.protein} גרם חלבון.` : "נוסף ליומן.");
              else setNote("ההוספה לא הצליחה. נסו שוב בעוד רגע.");
            })
          }
          className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Check aria-hidden="true" className="size-5" />}
          אכלתי את זה, הוסף ליומן
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            startSave(async () => {
              const r = await toggleSavedIdea(idea.slug, !isSaved).catch(() => ({ ok: false, saved: [] as string[] }));
              if (r.ok) {
                onSaved(r.saved);
                setNote(isSaved ? "הוסר מהרעיונות השמורים." : "נשמר ברעיונות שלך. לא נוסף ליומן.");
              } else setNote("השמירה לא הצליחה. נסו שוב בעוד רגע.");
            })
          }
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface font-medium ring-1 ring-line hover:bg-field"
        >
          {isSaved ? <BookmarkCheck aria-hidden="true" className="size-5" /> : <Bookmark aria-hidden="true" className="size-5" />}
          {isSaved ? "שמור ברעיונות שלי" : "שמירה כרעיון לארוחה"}
        </button>
      </div>
      {note ? (
        <p role="status" className="rounded-xl bg-field px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
    </>
  );
}
