import { describe, expect, it } from "vitest";
import { draftToRows, rowsToDraft } from "./mapping";
import { draftSchema, emptyDraft, firstIncompleteStep, stepErrors, type OnboardingDraft } from "./schema";

const NOW = new Date("2026-11-01T10:00:00Z");

function complete(): OnboardingDraft {
  return {
    ...emptyDraft(),
    display_name: "דנה",
    age: 34,
    height_cm: 168,
    weight_kg: 72.5,
    target_weight_kg: 68,
    goals: ["lose_weight", "strength"],
    dietary_pattern: "vegetarian",
    allergies: ["peanut"],
    likes: ["חומוס"],
    dislikes: ["כוסברה"],
    experience: "beginner",
    location: ["home"],
    equipment: ["dumbbells", "mat"],
    available_days: [0, 2, 4],
    session_minutes: 30,
    answers: {
      medical_condition: false,
      pregnancy: false,
      active_injury: false,
      chest_pain: false,
      fainting: false,
      eating_disorder: false,
      medical_restriction: false,
    },
    activity_level: "light",
    sleep_hours: 6.5,
    water_cups_now: 5,
    busy_days: [1],
  };
}

describe("questionnaire steps", () => {
  it("an empty draft starts at the first step", () => {
    expect(firstIncompleteStep(emptyDraft())).toBe("details");
  });

  it("a full draft has no incomplete step", () => {
    expect(firstIncompleteStep(complete())).toBeNull();
  });

  it("rejects users under 18", () => {
    expect(stepErrors("details", { ...complete(), age: 17 })).toContain("age");
  });

  it("requires every safety question to be answered", () => {
    const d = complete();
    d.answers.chest_pain = null;
    expect(stepErrors("safety", d)).toContain("answers");
  });

  it("allows at most three goals", () => {
    expect(stepErrors("goals", { ...complete(), goals: ["strength", "muscle", "endurance", "habits"] })).toContain("goals");
  });

  it("accepts a half-filled draft for autosave", () => {
    expect(draftSchema.safeParse({ ...emptyDraft(), display_name: "דנה" }).success).toBe(true);
  });
});

describe("draft ↔ rows mapping", () => {
  it("round-trips through the database shape", () => {
    const d = complete();
    const rows = draftToRows("u1", d, 3, NOW);
    expect(rows.profile.birth_year).toBe(1992);
    expect(rows.goals).toEqual([
      { user_id: "u1", goal_type: "lose_weight", priority: 1, active: true },
      { user_id: "u1", goal_type: "strength", priority: 2, active: true },
    ]);
    // PostgREST returns numeric columns as strings.
    const back = rowsToDraft(
      {
        profile: { ...rows.profile, height_cm: "168" as unknown as number, weight_kg: "72.5" as unknown as number },
        food: rows.food,
        exercise: rows.exercise,
        goals: [...rows.goals].reverse(),
      },
      NOW,
    );
    expect(back).toEqual(d);
  });

  it("stores the safety result alongside the answers", () => {
    const d = complete();
    d.answers.chest_pain = true;
    const rows = draftToRows("u1", d, 5, NOW);
    expect(rows.profile.safety_flags.result?.level).toBe("refer");
    expect(rows.profile.safety_flags.answers?.chest_pain).toBe(true);
  });
});
