# Billing (prepared, OFF)

Billing is intentionally disabled for the beta (spec §3.3, §19). No provider is chosen, no checkout exists,
no prices are shown, no card data is ever stored, and every user has full access.

## What exists

- `BILLING_ENABLED=false`, `PREMIUM_GATING_ENABLED=false` (env, read in `src/lib/config/flags.ts`).
  The `feature_flags` table mirrors them for the admin screen.
- `subscriptions` table: tier, status, provider, provider refs, period end. Users can read their own row only;
  only the server writes it.
- `src/lib/billing/index.ts`:
  - `BillingService` interface (provider-agnostic).
  - `DisabledBillingService`, returned by `getBillingService()` while billing is off.
  - `canAccessFeature(user, feature)`: the single access check. Returns true for every signed-in user
    while gating is off.
  - `TIER_FEATURES`: future tier → feature mapping, not shown anywhere.

## Connecting a provider later

1. Choose a provider after legal review (privacy, consumer protection, invoicing in Israel).
2. Add `src/lib/billing/providers/<name>.ts` implementing `BillingService`.
   Card data stays with the provider (hosted checkout); store only provider references.
3. Add a webhook route that verifies the provider signature and updates `subscriptions` with the service role.
4. Return the new service from `getBillingService()` when `billingEnabled` is true.
5. Turn on `BILLING_ENABLED` in staging first. Turn on `PREMIUM_GATING_ENABLED` only after existing beta
   users have been told what changes.
