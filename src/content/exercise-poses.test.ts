import { describe, expect, it } from "vitest";
import { bounds, points, solve } from "@/lib/exercise/figure";
import { DEMOS } from "./exercise-poses";
import { EXERCISES } from "./exercises";

describe("exercise demonstrations (follow-up spec §5)", () => {
  it("every exercise in the library has a demonstration of 2–3 captioned steps", () => {
    const missing = EXERCISES.filter((e) => !DEMOS[e.slug]).map((e) => e.slug);
    expect(missing).toEqual([]);
    for (const e of EXERCISES) {
      const d = DEMOS[e.slug];
      expect(d.frames.length, e.slug).toBeGreaterThanOrEqual(2);
      expect(d.frames.length, e.slug).toBeLessThanOrEqual(3);
      for (const f of d.frames) expect(f.caption.length, e.slug).toBeGreaterThan(2);
    }
  });
  it("has no demonstration for an exercise that is not in the library", () => {
    const slugs = new Set(EXERCISES.map((e) => e.slug));
    expect(Object.keys(DEMOS).filter((s) => !slugs.has(s))).toEqual([]);
  });
  it("solves every pose to finite points that stay above the floor", () => {
    for (const [slug, d] of Object.entries(DEMOS)) {
      for (const f of d.frames) {
        const p = points(solve(f.pose, d.view), d.view);
        for (const [joint, [x, y]] of Object.entries(p)) {
          expect(Number.isFinite(x) && Number.isFinite(y), `${slug} ${joint}`).toBe(true);
          if (d.floor !== false) expect(y, `${slug} ${joint} below the floor`).toBeGreaterThan(-1);
        }
      }
      const b = bounds(d);
      expect(b.w > 0 && b.h > 0, slug).toBe(true);
    }
  });
});
