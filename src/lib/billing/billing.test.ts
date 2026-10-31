import { describe, expect, it } from "vitest";
import { canAccessFeature, DisabledBillingService, getBillingService } from "./index";

const user = { id: "u1" };

describe("canAccessFeature", () => {
  it("denies anonymous users", () => {
    expect(canAccessFeature(null, "weekly_plan", { premiumGatingEnabled: false })).toBe(false);
  });

  it("gives every signed-in user full access while gating is off (beta)", () => {
    expect(canAccessFeature(user, "ai_coach_chat", { premiumGatingEnabled: false })).toBe(true);
    expect(canAccessFeature(user, "shopping_list", { premiumGatingEnabled: false })).toBe(true);
  });

  it("limits free users to free features once gating is on", () => {
    expect(canAccessFeature(user, "weekly_plan", { premiumGatingEnabled: true })).toBe(true);
    expect(canAccessFeature(user, "ai_coach_chat", { premiumGatingEnabled: true })).toBe(false);
  });

  it("treats only active or trialing subscriptions as premium", () => {
    const active = { id: "u2", subscription: { tier: "premium" as const, status: "active" as const } };
    const canceled = { id: "u3", subscription: { tier: "premium" as const, status: "canceled" as const } };
    expect(canAccessFeature(active, "ai_coach_chat", { premiumGatingEnabled: true })).toBe(true);
    expect(canAccessFeature(canceled, "ai_coach_chat", { premiumGatingEnabled: true })).toBe(false);
  });
});

describe("billing service", () => {
  it("is disabled by default and never creates a checkout", async () => {
    const svc = getBillingService({ billingEnabled: false });
    expect(svc).toBeInstanceOf(DisabledBillingService);
    expect(svc.enabled).toBe(false);
    await expect(svc.createCheckoutSession("u1", "premium")).rejects.toThrow(/disabled/);
  });

  it("refuses to run with billing on until a provider exists", () => {
    expect(() => getBillingService({ billingEnabled: true })).toThrow(/no billing provider/);
  });
});
