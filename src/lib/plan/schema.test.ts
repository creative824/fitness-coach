import { describe, expect, it } from "vitest";
import { weeklyPlanSchema } from "./schema";

const R = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const E = "7d4e5f6a-8b90-4e8a-9c21-3f2a9c1e5b7d";

function day(date: string, rest: boolean) {
  return {
    date,
    is_rest_day: rest,
    meals: [{ slot: "breakfast", meal_idea_id: R, portion: "light" }],
    workout: rest
      ? null
      : {
          title: "כוח לכל הגוף",
          location: "home",
          estimated_minutes: 25,
          difficulty: "beginner",
          blocks: [{ exercise_id: E, sets: 3, reps: 10, rest_seconds: 60 }],
          why: "מחזק רגליים, חזה וגב בזמן קצר",
        },
    habits: [{ type: "water", title: "שתייה", target: "שתייה לאורך היום" }],
  };
}

const valid = {
  schema_version: 1,
  week_start: "2026-11-01",
  summary: { focus: "להתחיל בהדרגה", principles: ["עקביות לפני עצימות"], assumptions: [] },
  targets: { calories_range: null, water_ml: 2000, workouts_per_week: 3 },
  days: ["01", "02", "03", "04", "05", "06", "07"].map((d, i) => day(`2026-11-${d}`, i % 2 === 1)),
  explanation: "שלושה אימונים קצרים בבית כי ציינת 25 דקות פנויות.",
};

describe("weeklyPlanSchema", () => {
  it("accepts a well-formed plan", () => {
    expect(weeklyPlanSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects free-text meals that are not library references", () => {
    const bad = structuredClone(valid) as Record<string, unknown> & typeof valid;
    (bad.days[0].meals[0] as Record<string, unknown>).meal_idea_id = "שקשוקה";
    expect(weeklyPlanSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a block with both reps and seconds", () => {
    const bad = structuredClone(valid);
    const block = bad.days[0].workout!.blocks[0] as Record<string, unknown>;
    block.seconds = 30;
    expect(weeklyPlanSchema.safeParse(bad).success).toBe(false);
  });

  it("requires exactly seven days", () => {
    const bad = { ...valid, days: valid.days.slice(0, 6) };
    expect(weeklyPlanSchema.safeParse(bad).success).toBe(false);
  });
});
