"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";
import { logWeight } from "@/lib/progress/actions";
import { bmiBand, bmiOf, BMI_BANDS } from "@/lib/progress/bmi";
import { trendChange, weeklyAverages, type WeightEntry } from "@/lib/progress/trend";

const s = getDictionary().screens.progress;
const shortDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" });

/** Weight entry and weekly trend. The chart updates on save, before the server answers. */
export function WeightCard({ initial, today, heightCm = null, fallbackKg = null }: { initial: WeightEntry[]; today: string; heightCm?: number | null; fallbackKg?: number | null }) {
  const [entries, setEntries] = useState(initial);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const points = weeklyAverages(entries);
  const change = trendChange(points);
  const latest = entries.at(-1);
  const bmi = bmiOf(latest?.weight_kg ?? fallbackKg, heightCm);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const kg = Number(value.replace(",", "."));
    if (!Number.isFinite(kg) || kg < 30 || kg > 350) {
      setError(true);
      return;
    }
    const prev = entries;
    setEntries([...entries.filter((x) => x.date !== today), { date: today, weight_kg: Math.round(kg * 10) / 10 }]);
    setValue("");
    setError(false);
    start(async () => {
      const r = await logWeight(kg).catch(() => ({ ok: false }));
      if (!r.ok) {
        setEntries(prev);
        setError(true);
      }
    });
  }

  // Chart geometry: weekly averages on a padded range so small changes stay small.
  const W = 320;
  const H = 120;
  const vals = points.map((p) => p.avg);
  const min = Math.min(...vals, Infinity) - 1;
  const max = Math.max(...vals, -Infinity) + 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : 16 + (i * (W - 32)) / (points.length - 1));
  const y = (v: number) => 12 + ((max - v) / (max - min || 1)) * (H - 36);

  return (
    <Card className="flex scroll-mt-6 flex-col gap-4" id="weight">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{s.weightTitle}</h2>
        {latest ? (
          <span className="text-sm text-ink-muted">
            {s.latest} <span className="num font-semibold text-ink">{latest.weight_kg}</span> {s.kg}
          </span>
        ) : null}
      </div>

      {bmi ? <BmiBar bmi={bmi} heightCm={heightCm!} /> : null}

      {points.length ? (
        <figure className="flex flex-col gap-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={s.chartLabel} direction="ltr">
            <line x1="0" x2={W} y1={H - 20} y2={H - 20} stroke="var(--color-line)" />
            {points.length > 1 ? (
              <polyline
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={points.map((p, i) => `${x(i)},${y(p.avg)}`).join(" ")}
              />
            ) : null}
            {points.map((p, i) => (
              <g key={p.weekStart}>
                <circle cx={x(i)} cy={y(p.avg)} r="4" fill="var(--color-accent)" stroke="var(--color-brand)" strokeWidth="2">
                  <title>{`${shortDate.format(new Date(`${p.weekStart}T00:00:00Z`))}: ${p.avg}`}</title>
                </circle>
                {i === 0 || i === points.length - 1 ? (
                  <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--color-ink-muted)">
                    {shortDate.format(new Date(`${p.weekStart}T00:00:00Z`))}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
          <figcaption className="text-sm text-ink-muted">
            {change === null ? s.trendNeedsWeeks : s.trendChange(change)}
          </figcaption>
        </figure>
      ) : (
        <p className="text-sm text-ink-muted">{s.noWeight}</p>
      )}

      <form onSubmit={save} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          {s.weightToday}
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={latest ? String(latest.weight_kg) : "70.5"}
            dir="ltr"
            className="num min-h-12 rounded-xl border border-line bg-field px-4 text-base transition-colors hover:border-ink/30 focus:border-brand focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !value}
          className="min-h-12 cursor-pointer rounded-xl bg-brand px-6 font-medium text-white transition-[background-color,transform] hover:bg-brand-strong active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s.save}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-warning">
          {s.weightError}
        </p>
      ) : null}
      <p className="text-xs text-ink-muted">{s.weightNote}</p>
    </Card>
  );
}

const TONE: Record<(typeof BMI_BANDS)[number]["tone"], string> = {
  sky: "bg-sky",
  accent: "bg-accent",
  warning: "bg-[#f5c451]",
  coral: "bg-coral",
};

/** BMI on a 15–40 scale with the WHO bands. */
function BmiBar({ bmi, heightCm }: { bmi: number; heightCm: number }) {
  const band = bmiBand(bmi);
  const lo = 15;
  const hi = 40;
  const pos = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  const widths = BMI_BANDS.map((b, i) => ((Math.min(hi, b.max) - (i ? BMI_BANDS[i - 1].max : lo)) / (hi - lo)) * 100);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-field p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-muted">מדד מסת גוף (BMI)</span>
        <span>
          <span className="num text-2xl font-bold">{bmi}</span> <span className="text-sm font-medium">{band.label}</span>
        </span>
      </div>
      <div className="relative" dir="ltr">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {BMI_BANDS.map((b, i) => (
            <span key={b.label} className={`${TONE[b.tone]} h-full opacity-80`} style={{ width: `${widths[i]}%` }} />
          ))}
        </div>
        <span className="absolute -top-1 size-4.5 -translate-x-1/2 rounded-full border-[3px] border-surface bg-ink shadow" style={{ left: pos(bmi) }} aria-hidden="true" />
        <div className="num relative mt-1 h-3 text-[10px] text-ink-muted">
          {[18.5, 25, 30].map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: pos(v) }}>
              {v}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-ink-muted">
        לפי גובה <span className="num">{heightCm}</span> ס״מ. המדד לא מבדיל בין שריר לשומן, ולכן הוא כיוון כללי בלבד.
      </p>
    </div>
  );
}
