import type { HTMLAttributes } from "react";

type Tone = "surface" | "night" | "lime" | "glass";

const tones: Record<Tone, string> = {
  surface: "bg-surface text-ink shadow-[var(--shadow-card)]",
  /** Dark contrast panel for hero metrics. */
  night: "bg-night text-white shadow-[var(--shadow-float)]",
  lime: "bg-accent text-ink",
  glass: "bg-white/60 text-ink ring-1 ring-white/80 backdrop-blur-xl",
};

export function Card({ className = "", tone = "surface", ...props }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={`rounded-[var(--radius-card)] p-5 ${tones[tone]} ${className}`} {...props} />;
}
