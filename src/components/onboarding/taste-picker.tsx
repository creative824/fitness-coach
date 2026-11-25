"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { TASTE_GROUPS, TASTE_LIMIT, TASTE_OPTIONS, type Taste } from "@/lib/food/prefs";

type Mode = keyof Taste;

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "likes", label: "אוהב", hint: "נציע יותר ארוחות עם אלה." },
  { key: "dislikes", label: "לא אוהב", hint: "לא נציע ארוחות עם אלה." },
  { key: "never", label: "לא אוכל", hint: "לא נציע אותם בכלל, למשל מסיבות של אמונה או טבעונות." },
];

const TILE: Record<Mode, string> = {
  likes: "bg-accent-soft ring-2 ring-accent-strong/50",
  dislikes: "bg-coral-soft ring-2 ring-coral/60",
  never: "bg-field ring-2 ring-ink/40 [&_.name]:line-through",
};
const BADGE: Record<Mode, string> = { likes: "👍", dislikes: "👎", never: "🚫" };

const KNOWN = new Set(TASTE_OPTIONS.map((o) => o.name));

/**
 * "מה אתה אוהב לאכול?": tap popular foods. A switch on top sets what a tap means: like, don't
 * like, or don't eat. Anything else can be typed. All optional.
 */
export function TastePicker({ value, onChange }: { value: Taste; onChange: (t: Taste) => void }) {
  const [mode, setMode] = useState<Mode>("likes");
  const [extra, setExtra] = useState("");
  const stateOf = (name: string): Mode | null => (value.likes.includes(name) ? "likes" : value.dislikes.includes(name) ? "dislikes" : value.never.includes(name) ? "never" : null);

  function toggle(name: string, to: Mode = mode) {
    const now = stateOf(name);
    const next: Taste = {
      likes: value.likes.filter((x) => x !== name),
      dislikes: value.dislikes.filter((x) => x !== name),
      never: value.never.filter((x) => x !== name),
    };
    if (now !== to && next[to].length < TASTE_LIMIT) next[to] = [...next[to], name];
    onChange(next);
  }

  function addExtra() {
    const words = extra
      .split(/[,،]/)
      .map((w) => w.trim().slice(0, 40))
      .filter((w) => w.length >= 2);
    let next = value;
    for (const w of words) if (stateOf(w) !== mode) next = { ...next, [mode]: [...next[mode].filter((x) => x !== w), w].slice(0, TASTE_LIMIT) };
    onChange(next);
    setExtra("");
  }

  const custom = (["likes", "dislikes", "never"] as Mode[]).flatMap((m) => value[m].filter((n) => !KNOWN.has(n)).map((n) => ({ n, m })));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label="מה המשמעות של בחירה" className="grid grid-cols-3 gap-1 rounded-xl bg-field p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`min-h-11 cursor-pointer rounded-lg text-sm font-medium ${mode === m.key ? "bg-surface shadow-[var(--shadow-card)]" : "text-ink-muted"}`}
            >
              {BADGE[m.key]} {m.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-muted">{MODES.find((m) => m.key === mode)!.hint}</p>
      </div>

      {TASTE_GROUPS.map((g) => (
        <fieldset key={g.title} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{g.title}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.options.map((o) => {
              const st = stateOf(o.name);
              return (
                <button
                  key={o.name}
                  type="button"
                  aria-pressed={st !== null}
                  aria-label={st ? `${o.name}: ${MODES.find((m) => m.key === st)!.label}` : o.name}
                  onClick={() => toggle(o.name)}
                  className={`relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center transition-colors ${st ? TILE[st] : "bg-surface ring-1 ring-line hover:bg-field"}`}
                >
                  <span aria-hidden="true" className="text-3xl leading-none">
                    {o.emoji}
                  </span>
                  <span className="name text-sm leading-tight font-medium">{o.name}</span>
                  {st ? (
                    <span aria-hidden="true" className="absolute top-1 end-1 text-xs">
                      {BADGE[st]}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col gap-2">
        <label htmlFor="taste-extra" className="text-sm font-semibold">
          משהו שלא ברשימה? ({MODES.find((m) => m.key === mode)!.label})
        </label>
        <div className="flex gap-2">
          <input
            id="taste-extra"
            value={extra}
            onChange={(e) => setExtra(e.target.value.slice(0, 120))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addExtra();
              }
            }}
            placeholder="למשל: סלמון, חצילים"
            className="min-h-12 min-w-0 flex-1 rounded-xl bg-field px-4 outline-none focus:bg-surface focus:ring-1 focus:ring-ink"
          />
          <button type="button" onClick={addExtra} disabled={extra.trim().length < 2} aria-label="הוספה" className="flex size-12 cursor-pointer items-center justify-center rounded-xl bg-brand text-white disabled:opacity-40">
            <Plus aria-hidden="true" className="size-5" />
          </button>
        </div>
        {custom.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {custom.map(({ n, m }) => (
              <li key={`${m}:${n}`} className={`inline-flex min-h-9 items-center gap-1 rounded-full ps-3 pe-1 text-sm ${TILE[m]}`}>
                <span aria-hidden="true">{BADGE[m]}</span>
                <span className="name">{n}</span>
                <button type="button" onClick={() => toggle(n, m)} aria-label={`הסרת ${n}`} className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-white/60">
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
