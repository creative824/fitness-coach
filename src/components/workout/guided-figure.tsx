"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEMOS } from "@/content/exercise-poses";
import { blend, solve } from "@/lib/exercise/figure";
import { FigureSvg } from "@/components/exercise/figure-svg";

const noop = () => () => {};
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The figure at a given point of one rep, so the drawing and the counter move together:
 * 0 → the start pose, 0.5 → the bottom of the movement, 1 → back at the start (the rep counts).
 * For a hold (`hold`), the figure stays in the working pose.
 */
export function GuidedFigure({ slug, progress, highlight, hold = false, className = "" }: { slug: string; progress: number; highlight: string[]; hold?: boolean; className?: string }) {
  const demo = DEMOS[slug];
  const solved = useMemo(() => demo?.frames.map((f) => solve(f.pose, demo.view)) ?? [], [demo]);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted || !demo || !solved.length) return <div className={className} />;
  const n = solved.length;
  let pose = solved[0];
  if (hold) pose = solved[n > 2 ? 1 : n - 1];
  else if (n > 1) {
    // Down through the key poses, then back up the same way.
    const path = [...solved, ...solved.slice(0, -1).reverse()];
    const segs = path.length - 1;
    const x = Math.min(0.9999, Math.max(0, progress)) * segs;
    const i = Math.floor(x);
    pose = blend(path[i], path[i + 1], ease(x - i));
  }
  return <FigureSvg demo={demo} solved={pose} highlight={highlight} className={className} />;
}

export function hasDemo(slug: string): boolean {
  return Boolean(DEMOS[slug]);
}
