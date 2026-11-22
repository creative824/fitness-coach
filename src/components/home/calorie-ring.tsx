import { fmt } from "./day-context";

/** Calories eaten against the daily target, as a ring. Over by more than 10% turns coral. */
export function CalorieRing({ eaten, target, size = 132 }: { eaten: number; target: number; size?: number }) {
  const ratio = target > 0 ? eaten / target : 0;
  const over = ratio > 1.1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const shown = Math.min(ratio, 1);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={over ? "var(--color-coral)" : "var(--color-accent)"}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="num text-[2rem] font-bold">{fmt(eaten)}</span>
        <span className="mt-1 text-[11px] text-white/60">
          מתוך <span className="num">{fmt(target)}</span>
        </span>
      </div>
    </div>
  );
}
