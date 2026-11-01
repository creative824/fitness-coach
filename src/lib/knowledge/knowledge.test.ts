import { describe, expect, it } from "vitest";
import { KNOWLEDGE, type KnowledgeTopic } from "@/content/knowledge";
import { emptyDraft } from "@/lib/onboarding/schema";
import { compareWeeks, summarizeWeek } from "@/lib/progress/trend";
import { GOAL_GUIDE, goalKind, mealFrame, mealRanges } from "@/lib/nutrition/frame";
import { personalNote } from "./personal";

describe("knowledge cards (follow-up spec §2)", () => {
  it("every card is short and cites at least one https source", () => {
    for (const [k, c] of Object.entries(KNOWLEDGE)) {
      const sentences = c.body.split(/[.!?](\s|$)/).filter((x) => x.trim().length > 3).length;
      expect(sentences, k).toBeGreaterThanOrEqual(2);
      expect(sentences, k).toBeLessThanOrEqual(4);
      expect(c.sources.length, k).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.url.startsWith("https://"), k).toBe(true);
    }
  });
  it("says nothing personal without real data", () => {
    for (const k of Object.keys(KNOWLEDGE) as KnowledgeTopic[]) {
      expect(personalNote(k, { draft: { ...emptyDraft(), sleep_hours: null, meals_per_day: null }, plan: null }), k).toBeNull();
    }
  });
  it("uses the user's own numbers when there are any", () => {
    const d = { ...emptyDraft(), weight_kg: 80, sleep_hours: 6 };
    expect(personalNote("sleep", { draft: d, plan: null })).toContain("6");
  });
});

describe("meal frame (follow-up spec §6)", () => {
  it("never suggests a food the user is allergic to or that breaks the diet", () => {
    const d = { ...emptyDraft(), dietary_pattern: "vegan" as const, allergies: ["gluten" as const, "sesame" as const, "soy" as const] };
    for (const slot of ["breakfast", "lunch", "dinner", "snack"] as const) {
      for (let day = 0; day < 7; day++) {
        const ex = mealFrame(slot, d, goalKind(d), day).examples.join(" ");
        for (const bad of ["ביצים", "יוגורט", "גבינה", "עוף", "דג", "טונה", "לחם", "פסטה", "שיבולת", "טחינה", "טופו", "אדממה"]) {
          expect(ex.includes(bad), `${slot} ${day} ${bad}`).toBe(false);
        }
      }
    }
  });
  it("drops disliked foods", () => {
    const d = { ...emptyDraft(), dislikes: ["טונה", "ביצים"] };
    const ex = [0, 1, 2, 3, 4, 5, 6].flatMap((i) => mealFrame("lunch", d, "maintain", i).examples).join(" ");
    expect(ex.includes("טונה") || ex.includes("ביצים")).toBe(false);
  });
  it("differs by goal", () => {
    expect(GOAL_GUIDE.lose).not.toBe(GOAL_GUIDE.gain);
    expect(mealFrame("lunch", emptyDraft(), "lose").groups.join()).not.toBe(mealFrame("lunch", emptyDraft(), "gain").groups.join());
  });
  it("gives meal ranges only with a daily range, and they add up to about the day", () => {
    expect(mealRanges(["breakfast", "lunch"], null)).toEqual([null, null]);
    const r = mealRanges(["breakfast", "lunch", "dinner"], [1800, 2200]) as [number, number][];
    expect(r.every(([a, b]) => b > a)).toBe(true);
    const lo = r.reduce((s, x) => s + x[0], 0);
    expect(Math.abs(lo - 1800)).toBeLessThanOrEqual(100);
  });
});

describe("weekly summary (follow-up spec §8)", () => {
  const day = (date: string, earned: number, possible = 40) => ({ date, earned, possible });
  it("counts only days so far and a streak up to today", () => {
    const days = [day("2026-11-01", 30), day("2026-11-02", 20), day("2026-11-03", 25), day("2026-11-04", 0), day("2026-11-05", 0)];
    const s = summarizeWeek(days, "2026-11-03");
    expect(s.total).toBe(75);
    expect(s.countedDays).toBe(3);
    expect(s.average).toBe(25);
    expect(s.streak).toBe(3);
  });
  it("does not break the streak because today is not marked yet", () => {
    const s = summarizeWeek([day("2026-11-01", 10), day("2026-11-02", 10), day("2026-11-03", 0)], "2026-11-03");
    expect(s.streak).toBe(2);
  });
  it("compares only with enough data, and never as a drop", () => {
    const strong = summarizeWeek([1, 2, 3, 4].map((i) => day(`2026-11-0${i}`, 35)), "2026-11-07");
    const weak = summarizeWeek([1, 2, 3, 4].map((i) => day(`2026-10-2${i}`, 10)), "2026-11-07");
    expect(compareWeeks(strong, weak)).toContain("יותר");
    expect(compareWeeks(weak, strong)).toBeNull();
    const short = summarizeWeek([day("2026-11-01", 35)], "2026-11-07");
    expect(compareWeeks(short, weak)).toBeNull();
  });
});
