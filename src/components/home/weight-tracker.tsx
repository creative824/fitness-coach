"use client";

import { Check, Minus, Plus, Scale, TrendingDown, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { logWeight } from "@/lib/progress/actions";
import { bmiOf } from "@/lib/progress/bmi";

export interface WeightInfo {
  /** Weigh-ins of the last weeks, oldest first. */
  history: { date: string; kg: number }[];
  /** Weight from the questionnaire, when nothing was logged yet. */
  startKg: number | null;
  heightCm: number | null;
  today: string;
}

/** Days without a weigh-in before the screen asks for one. */
export const REMIND_AFTER_DAYS = 3;

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const DISMISS_KEY = "weight-reminder-dismissed";
const noop = () => () => {};
function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/**
 * Weight on the today screen: the latest weigh-in, the change since the first one shown, a small
 * line of the last weigh-ins, and a quick entry (any day). After a few days without a weigh-in,
 * a gentle reminder opens it; "not now" hides it until tomorrow.
 */
export function WeightTracker({ info, onSaved, local = false }: { info: WeightInfo; onSaved?: (kg: number) => void; local?: boolean }) {
  const [history, setHistory] = useState(info.history);
  const last = history.at(-1) ?? null;
  const current = last?.kg ?? info.startKg;
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState(current ?? 70);
  const [error, setError] = useState(false);
  const [saving, start] = useTransition();
  const [closed, setClosed] = useState(false);
  // "Not now" is kept for the day in this browser. Before hydration the reminder stays hidden.
  const stored = useSyncExternalStore(noop, readDismissed, () => info.today);
  const dismissed = closed || stored === info.today;

  const since = last ? dayDiff(last.date, info.today) : null;
  const due = since === null || since >= REMIND_AFTER_DAYS;
  function dismiss() {
    setClosed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, info.today);
    } catch {}
  }

  function save() {
    const value = Math.round(kg * 10) / 10;
    const prev = history;
    setHistory([...history.filter((h) => h.date !== info.today), { date: info.today, kg: value }]);
    setOpen(false);
    setError(false);
    if (local) return;
    start(async () => {
      const r = await logWeight(value).catch(() => ({ ok: false }));
      if (!r.ok) {
        setHistory(prev);
        setError(true);
      } else onSaved?.(value);
    });
  }

  const first = history[0] ?? null;
  const change = first && last && history.length > 1 ? Math.round((last.kg - first.kg) * 10) / 10 : null;
  const bmi = bmiOf(current, info.heightCm);

  return (
    <div className="flex flex-col gap-2">
      {due && !dismissed && !open ? (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-accent px-3 py-2.5 text-ink">
          <Scale aria-hidden="true" className="size-5 shrink-0" />
          <span className="flex-1 text-sm leading-snug font-medium">
            {since === null ? "מתחילים לעקוב: מה המשקל שלך היום?" : `עברו ${since} ימים מהשקילה האחרונה. רוצה לעדכן?`}
          </span>
          <button type="button" onClick={() => setOpen(true)} className="min-h-9 cursor-pointer rounded-lg bg-night px-3 text-sm font-medium text-white">
            עדכון
          </button>
          <button type="button" onClick={dismiss} aria-label="לא עכשיו" className="flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-ink/10">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 text-white/70">
            <Scale aria-hidden="true" className="size-4" />
            משקל
          </span>
          <span className="flex items-center gap-2.5">
            {current ? (
              <span>
                <span className="num font-semibold">{current}</span> ק״ג
              </span>
            ) : (
              <span className="text-white/60">עוד לא נשקלת</span>
            )}
            {bmi ? (
              <span dir="ltr" className="rounded-md bg-white/10 px-1.5 text-xs">
                BMI <span className="num font-semibold">{bmi}</span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setKg(current ?? 70);
                setOpen(!open);
              }}
              aria-expanded={open}
              className="min-h-8 cursor-pointer rounded-lg bg-white/10 px-2.5 text-xs font-medium hover:bg-white/20"
            >
              {open ? "סגירה" : "עדכון"}
            </button>
          </span>
        </div>

        {history.length > 1 ? <Sparkline points={history} /> : null}
        {change !== null ? (
          <span className="flex items-center gap-1.5 text-xs text-white/70">
            {change <= 0 ? <TrendingDown aria-hidden="true" className="size-3.5 text-accent" /> : <TrendingUp aria-hidden="true" className="size-3.5 text-coral" />}
            {change === 0 ? "ללא שינוי" : change < 0 ? `ירדת ${Math.abs(change)} ק״ג` : `עלית ${change} ק״ג`} מאז {shortDate(first!.date)}
            {first ? ` (${(Math.abs(change) / first.kg * 100).toFixed(1)}%)` : ""}
            <Link href="/progress#weight" className="ms-auto underline underline-offset-2 hover:text-white">
              מעקב מלא
            </Link>
          </span>
        ) : null}

        {open ? (
          <div className="flex flex-col gap-2 border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => setKg((k) => Math.max(30, Math.round((k - 0.1) * 10) / 10))} aria-label="פחות 100 גרם" className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <label className="flex items-baseline gap-1">
                <span className="sr-only">משקל בק״ג</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={30}
                  max={350}
                  value={kg}
                  onChange={(e) => setKg(Number(e.target.value))}
                  className="num w-24 rounded-lg bg-white/10 px-2 py-1 text-center text-2xl font-semibold text-white outline-none focus:ring-2 focus:ring-accent"
                />
                <span className="text-sm text-white/70">ק״ג</span>
              </label>
              <button type="button" onClick={() => setKg((k) => Math.min(350, Math.round((k + 0.1) * 10) / 10))} aria-label="יותר 100 גרם" className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving || !(kg >= 30 && kg <= 350)}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-ink hover:bg-accent-strong disabled:opacity-50"
            >
              <Check aria-hidden="true" className="size-4" />
              שמירת משקל להיום
            </button>
            <p className="text-center text-[11px] text-white/50">כדאי להישקל בבוקר, אחרי השירותים ולפני האוכל, כדי שהמספרים יהיו דומים.</p>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-xs text-coral">השמירה לא הצליחה. נסו שוב.</p> : null}
      </div>
    </div>
  );
}

const fmtDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" });
const shortDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate.format(new Date(`${d}T12:00:00Z`)) : d);

/** The last weigh-ins as a small line. */
function Sparkline({ points }: { points: { date: string; kg: number }[] }) {
  const pts = points.slice(-12);
  const W = 280;
  const H = 36;
  const vals = pts.map((p) => p.kg);
  const lo = Math.min(...vals) - 0.3;
  const hi = Math.max(...vals) + 0.3;
  const x = (i: number) => 4 + (i * (W - 8)) / Math.max(1, pts.length - 1);
  const y = (v: number) => 4 + ((hi - v) / (hi - lo || 1)) * (H - 8);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" aria-label={`${pts.length} שקילות אחרונות`} role="img">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.kg)} r={i === pts.length - 1 ? 3.5 : 2} className={i === pts.length - 1 ? "fill-accent" : "fill-white/60"} />
      ))}
    </svg>
  );
}
