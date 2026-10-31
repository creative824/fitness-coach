/**
 * Billing preparation (spec §19). Everything here is inert while the flags are off.
 *
 * - `BillingService` is provider-agnostic. No provider is chosen yet.
 * - `canAccessFeature` is the single place that will decide premium access later.
 *   While PREMIUM_GATING_ENABLED is false, every user gets every feature.
 *
 * How to connect a provider later is documented in docs/BILLING.md.
 */
import { flags as defaultFlags, type Flags } from "@/lib/config/flags";

export const PLAN_TIERS = ["free", "premium"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

export type Feature =
  | "weekly_plan"
  | "daily_tasks"
  | "ai_coach_chat"
  | "muscle_map"
  | "shopping_list"
  | "progress_history";

/** Future tier → feature mapping. Not shown to users and has no prices. */
export const TIER_FEATURES: Record<PlanTier, readonly Feature[]> = {
  free: ["weekly_plan", "daily_tasks", "muscle_map", "progress_history"],
  premium: [
    "weekly_plan",
    "daily_tasks",
    "ai_coach_chat",
    "muscle_map",
    "shopping_list",
    "progress_history",
  ],
};

export interface SubscriptionInfo {
  tier: PlanTier;
  status: SubscriptionStatus;
}

export interface AccessUser {
  id: string;
  subscription?: SubscriptionInfo | null;
}

export function canAccessFeature(
  user: AccessUser | null,
  feature: Feature,
  flags: Pick<Flags, "premiumGatingEnabled"> = defaultFlags,
): boolean {
  if (!user) return false;
  // Beta: gating is off, so every signed-in user has full access.
  if (!flags.premiumGatingEnabled) return true;

  const sub = user.subscription;
  const activeTier: PlanTier =
    sub && (sub.status === "active" || sub.status === "trialing") ? sub.tier : "free";
  return TIER_FEATURES[activeTier].includes(feature);
}

/** Provider-agnostic contract. A concrete provider is added only when billing is turned on. */
export interface BillingService {
  readonly enabled: boolean;
  getSubscription(userId: string): Promise<SubscriptionInfo>;
  createCheckoutSession(userId: string, tier: PlanTier): Promise<{ url: string }>;
  handleWebhook(payload: unknown, signature: string | null): Promise<void>;
}

/** Default service while BILLING_ENABLED=false: never charges, never redirects. */
export class DisabledBillingService implements BillingService {
  readonly enabled = false;

  async getSubscription(): Promise<SubscriptionInfo> {
    return { tier: "free", status: "none" };
  }

  async createCheckoutSession(): Promise<{ url: string }> {
    throw new Error("Billing is disabled (BILLING_ENABLED=false).");
  }

  async handleWebhook(): Promise<void> {
    throw new Error("Billing is disabled (BILLING_ENABLED=false).");
  }
}

export function getBillingService(flags: Pick<Flags, "billingEnabled"> = defaultFlags): BillingService {
  if (flags.billingEnabled) {
    throw new Error(
      "BILLING_ENABLED=true but no billing provider is implemented. See docs/BILLING.md.",
    );
  }
  return new DisabledBillingService();
}
