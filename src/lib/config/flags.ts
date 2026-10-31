/**
 * Feature flags read from the environment (spec §3.3, §19).
 * Billing is prepared but OFF: no provider, no checkout, no premium gating.
 * Only an explicit "true" turns a flag on.
 */
function envFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export const flags = {
  billingEnabled: envFlag(process.env.BILLING_ENABLED),
  premiumGatingEnabled: envFlag(process.env.PREMIUM_GATING_ENABLED),
} as const;

export type Flags = typeof flags;
