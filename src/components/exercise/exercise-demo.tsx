"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEMOS } from "@/content/exercise-poses";
import { blend, solve, type Solved } from "@/lib/exercise/figure";
import { FigureSvg } from "./figure-svg";

const HOLD_MS = 650;
const MOVE_MS = 1000;
const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const m = matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Animated demonstration: the figure moves start → middle → end and back, with the working
 * muscles tinted. The key poses sit underneath as numbered steps; tapping one stops on it.
 * With reduced motion the animation does not start on its own.
 */
export function ExerciseDemo({ slug, name, highlight }: { slug: string; name: string; highlight: string[] }) {
  const demo = DEMOS[slug];
  const solved = useMemo(() => demo?.frames.map((f) => solve(f.pose, demo.view)) ?? [], [demo]);
  // Plays on its own unless the system asks for reduced motion; a tap overrides either way.
  const reduced = useSyncExternalStore(subscribeMotion, () => matchMedia(REDUCED).matches, () => true);
  const [choice, setChoice] = useState<"auto" | "play" | "pause">("auto");
  const playing = choice === "play" || (choice === "auto" && !reduced);
  const [frame, setFrame] = useState(0);
  const [pose, setPose] = useState<Solved | null>(solved[0] ?? null);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing || solved.length < 2) return;
    const n = solved.length;
    const cycle = n * (HOLD_MS + MOVE_MS);
    const start = performance.now() - frame * (HOLD_MS + MOVE_MS);
    const tick = (now: number) => {
      const t = (now - start) % cycle;
      const i = Math.floor(t / (HOLD_MS + MOVE_MS));
      const inStep = t - i * (HOLD_MS + MOVE_MS);
      const k = inStep < HOLD_MS ? 0 : ease((inStep - HOLD_MS) / MOVE_MS);
      setPose(blend(solved[i], solved[(i + 1) % n], k));
      setFrame(k > 0.5 ? (i + 1) % n : i);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // `frame` is read once to resume from the step the user stopped on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, solved]);

  if (!demo || !pose) {
    return <p className="rounded-xl bg-field px-4 py-3 text-sm text-ink-muted">ההדגמה לתרגיל הזה עוד בהכנה. בינתיים, ההוראות למטה מתארות את התנועה צעד אחר צעד.</p>;
  }

  function show(i: number) {
    setChoice("pause");
    setFrame(i);
    setPose(solved[i]);
  }

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative rounded-xl bg-field text-ink">
        <FigureSvg demo={demo} solved={pose} highlight={highlight} className="mx-auto h-44 w-full max-w-xs" title={`הדגמה: ${name}`} />
        <button
          type="button"
          onClick={() => setChoice(playing ? "pause" : "play")}
          aria-label={playing ? "עצירת ההדגמה" : "הפעלת ההדגמה"}
          className="absolute start-2 top-2 flex size-9 cursor-pointer items-center justify-center rounded-lg bg-surface/90 text-ink shadow-sm ring-1 ring-ink/5 transition-colors hover:bg-surface"
        >
          {playing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
        </button>
      </div>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${demo.frames.length}, minmax(0, 1fr))` }}>
        {demo.frames.map((f, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => show(i)}
              aria-pressed={!playing && frame === i}
              className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 text-center text-xs transition-colors ${
                frame === i ? "bg-accent-soft text-ink" : "text-ink-muted hover:bg-field"
              }`}
            >
              <FigureSvg demo={demo} solved={solved[i]} className="h-12 w-full" />
              <span className="leading-snug">
                <span className="num font-semibold">{i + 1}.</span> {f.caption}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <figcaption className="text-[11px] text-ink-muted">
        איור סכמטי. בכתום: השרירים העיקריים שעובדים.
      </figcaption>
    </figure>
  );
}
