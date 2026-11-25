"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A bottom sheet: slides up over the screen on a phone, a centred panel on wider screens.
 * Closes with the X, Escape or a tap on the dimmed backdrop. Portalled to <body>.
 */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" dir="rtl">
      <button type="button" aria-label="סגירה" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-night/40 backdrop-blur-[2px]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-canvas shadow-[var(--shadow-float)] outline-none sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface ring-1 ring-line hover:bg-field"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pt-2 pb-5">{children}</div>
        {footer ? <div className="border-t border-line bg-canvas px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
