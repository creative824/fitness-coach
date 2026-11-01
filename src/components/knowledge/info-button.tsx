"use client";

import { ExternalLink, Info, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { KNOWLEDGE, type KnowledgeTopic } from "@/content/knowledge";

const SEEN_KEY = "kc-seen";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
let listeners: (() => void)[] = [];
const subscribe = (cb: () => void) => {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
};
function markSeen(topic: string) {
  try {
    const seen = new Set(readSeen());
    seen.add(topic);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Private mode or blocked storage: the dot just stays.
  }
  for (const l of listeners) l();
}

/**
 * The small "i" next to a task, target or metric (follow-up spec §2). Opens on tap, not on
 * hover, as a short card: title, 2–4 sentences, "why it matters to you" and the sources.
 * A quiet dot marks a card that was not opened yet on this device; nothing moves.
 */
export function InfoButton({
  topic,
  personal,
  tone = "light",
}: {
  topic: KnowledgeTopic;
  personal?: string | null;
  tone?: "light" | "dark";
}) {
  const card = KNOWLEDGE[topic];
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const seen = useSyncExternalStore(
    subscribe,
    () => readSeen().includes(topic),
    () => true,
  );

  // The dialog is portalled to <body>: the button often sits inside a heading or a <dt>,
  // where a <dialog> is not allowed.
  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);

  function show() {
    setOpen(true);
    markSeen(topic);
  }
  function close() {
    ref.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`מידע: ${card.title}`}
        className={`relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
          tone === "dark"
            ? "text-white/60 hover:bg-white/10 hover:text-white"
            : "text-ink-muted hover:bg-field hover:text-ink"
        }`}
      >
        <Info aria-hidden="true" className="size-4" />
        {seen ? null : (
          <span
            aria-hidden="true"
            className="absolute end-0.5 top-0.5 size-1.5 rounded-full bg-coral"
          />
        )}
      </button>
      {open
        ? createPortal(
            <dialog
              ref={ref}
              onClose={() => setOpen(false)}
              onClick={(e) => {
                if (e.target === ref.current) close();
              }}
              aria-labelledby={`kc-${topic}`}
              className="m-auto mb-4 w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-card)] bg-surface p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-night/40 sm:mb-auto"
            >
              {
                <div className="flex flex-col gap-3 p-5" dir="rtl">
                  <div className="flex items-start justify-between gap-3">
                    <h2
                      id={`kc-${topic}`}
                      className="flex items-center gap-2 text-lg font-semibold"
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                        <Info aria-hidden="true" className="size-4" />
                      </span>
                      {card.title}
                    </h2>
                    <button
                      type="button"
                      onClick={close}
                      aria-label="סגירה"
                      className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-field hover:text-ink"
                    >
                      <X aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed">{card.body}</p>
                  <div className="rounded-xl bg-accent-soft px-4 py-3">
                    <p className="text-xs font-semibold text-accent-strong">
                      למה זה חשוב לך
                    </p>
                    <p className="text-sm leading-relaxed">
                      {personal ?? card.general}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-ink-muted">
                      קרא עוד במקורות
                    </p>
                    <ul className="flex flex-col gap-1">
                      {card.sources.map((src) => (
                        <li key={src.url}>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-start gap-1.5 text-sm underline-offset-2 hover:underline"
                          >
                            <ExternalLink
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                            />
                            <span>
                              <span dir="ltr">{src.title}</span>
                              <span className="text-ink-muted">
                                {" "}
                                · {src.publisher}
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    מידע כללי, לא ייעוץ רפואי.
                  </p>
                </div>
              }
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
