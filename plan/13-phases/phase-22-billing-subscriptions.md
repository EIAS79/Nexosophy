# Phase 22 — Payments, Subscriptions & Billing

> **Canonical execution file:** `plan/13-phases/phase-22-billing-subscriptions.md`

## Objective

Activate the commercial transaction layer only after product/identity/authorization foundations are stable.

## Owning specifications

- [03-stripe-billing.md](../02-identity-billing/03-stripe-billing.md)
- [04-entitlements-admin-billing.md](../02-identity-billing/04-entitlements-admin-billing.md)
- [03-pricing.md](../11-public-website/03-pricing.md)

## Prerequisites

- [ ] Phase 21 passed.
- [ ] Legal business/payout account known.
- [ ] Production domains and legal policies ready.
- [ ] Launch entitlement catalog frozen/versioned.

## Required deliverables

- [ ] Stripe products/prices per environment.
- [ ] Customer mapping.
- [ ] Hosted Checkout.
- [ ] Signed raw-body webhook endpoint and event ledger.
- [ ] Subscription/invoice/trial/failure/grace state machines.
- [ ] Entitlement recomputation.
- [ ] Customer Portal.
- [ ] Billing settings/invoices UI.
- [ ] Seat quantity behavior.
- [ ] Upgrade/downgrade/cancel/reactivate.
- [ ] Tax/VAT path.
- [ ] Admin/support billing diagnostics.
- [ ] Reconciliation jobs and payout/accounting runbooks.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Stripe test mode checkout lifecycle.
- [ ] Duplicate/delayed/out-of-order webhooks.
- [ ] Browser success redirect without webhook cannot unlock access.
- [ ] Provider outage/reconciliation.
- [ ] Quota/entitlement race.
- [ ] Cancellation/failure/grace boundary.

## Exit gate

- [ ] Paid features derive from verified internal entitlement state.
- [ ] Money flow to configured merchant payout account is operationally verified.
- [ ] Billing failures are observable and recoverable.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: