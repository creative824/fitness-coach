"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEMOS } from "@/content/exercise-poses";
import { blend, solve, type Solved } from "@/lib/exercise/figure";
import { FigureSvg } from "./figure-svg";

const HOLD_MS = 500;
const MOVE_MS = 900;
const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const m = matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const noop = () => () => {};
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The exercise's animated figure on its own, without controls, for workout tiles. Loops while
 * on screen; stands still on its first pose with reduced motion or off screen.
 */
export function ExerciseLoop({ slug, highlight, className = "" }: { slug: string; highlight: string[]; className?: string }) {
  const demo = DEMOS[slug];
  const solved = useMemo(() => demo?.frames.map((f) => solve(f.pose, demo.view)) ?? [], [demo]);
  const reduced = useSyncExternalStore(subscribeMotion, () => matchMedia(REDUCED).matches, () => true);
  // Drawn on the client only: the solved angles can differ in the last digit from the server's.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [pose, setPose] = useState<Solved | null>(solved[0] ?? null);
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible || solved.length < 2) return;
    const n = solved.length;
    const step = HOLD_MS + MOVE_MS;
    const start = performance.now();
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // About 30 frames a second is smooth enough and keeps several tiles light on a phone.
      if (now - last < 33) return;
      last = now;
      const t = (now - start) % (n * step);
      const i = Math.floor(t / step);
      const inStep = t - i * step;
      setPose(blend(solved[i], solved[(i + 1) % n], inStep < HOLD_MS ? 0 : ease((inStep - HOLD_MS) / MOVE_MS)));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, visible, solved]);

  return (
    <div ref={box} className={className}>
      {mounted && demo && pose ? <FigureSvg demo={demo} solved={pose} highlight={highlight} className="size-full" /> : null}
    </div>
  );
}
