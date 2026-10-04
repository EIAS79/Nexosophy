# ADR 0008 — Stripe Billing Boundary

**Status:** Accepted

## Decision
Use **Stripe Checkout, Billing and Customer Portal** for subscriptions/payments.

Nexosophy owns plan mapping, billing-account relationships, entitlements and quota enforcement.

## Authoritative flow
Pricing → backend Checkout Session → Stripe-hosted Checkout → signed webhook → server reconciliation → internal subscription/entitlement update.

The browser success redirect is never proof of payment.

## Rules
- card data is never stored by Nexosophy;
- webhook event IDs are deduplicated;
- out-of-order events reconcile current Stripe state;
- ordinary entitlement checks do not call Stripe;
- payout occurs through the configured legal merchant Stripe account and bank relationship.

## References
- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
