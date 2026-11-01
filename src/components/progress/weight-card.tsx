"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/he";
import { logWeight } from "@/lib/progress/actions";
import { trendChange, weeklyAverages, type WeightEntry } from "@/lib/progress/trend";

const s = getDictionary().screens.progress;
const shortDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" });

/** Weight entry and weekly trend. The chart updates on save, before the server answers. */
export function WeightCard({ initial, today }: { initial: WeightEntry[]; today: string }) {
  const [entries, setEntries] = useState(initial);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const points = weeklyAverages(entries);
  const change = trendChange(points);
  const latest = entries.at(-1);

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
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{s.weightTitle}</h2>
        {latest ? (
          <span className="text-sm text-ink-muted">
            {s.latest} <span className="num font-semibold text-ink">{latest.weight_kg}</span> {s.kg}
          </span>
        ) : null}
      </div>

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
