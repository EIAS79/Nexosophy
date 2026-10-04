# Stripe Billing, Checkout and Subscription Lifecycle

> **Plan path:** `plan/02-identity-billing/03-stripe-billing.md`

## Purpose

Implement real subscription payments through Stripe-hosted surfaces with server-authoritative webhook reconciliation.

## User / product outcomes

- Users can select a plan, pay on Stripe, return to Nexosophy and receive entitlements only after verified provider state.
- Users can manage payment methods/invoices/subscription in Stripe Customer Portal.
- Merchant funds settle through the configured Stripe business account and payout bank account.

## Required capabilities

- Stripe Products/Prices mapped to internal PlanVersion.
- Monthly/annual billing.
- Trials where offered.
- Coupons/promotion codes policy.
- Upgrade/downgrade/proration.
- Cancellation/reactivation.
- Invoice/payment failure/grace state.
- Customer Portal.
- Refund/dispute operational flow.
- Tax/VAT configuration boundary.
- Admin links to Stripe Dashboard.

## Routes / surfaces

- `/pricing`
- `/settings/billing`
- `/workspace/:id/settings/billing`
- `/api/billing/checkout`
- `/api/billing/portal`
- `/api/webhooks/stripe`

## Core data model

- `BillingAccount`
- `Plan`
- `PlanVersion`
- `Subscription`
- `InvoiceMirror`
- `PaymentEvent`
- `Entitlement`
- `WebhookEvent`

## Service and API contract

- POST /v1/billing/checkout-session creates Stripe Checkout Session server-side.
- POST /v1/billing/portal-session creates short-lived portal session.
- POST /webhooks/stripe verifies raw-body signature, stores event ID, applies idempotent state transition, then acknowledges.
- Browser success redirect is never proof of payment.

## Scale, concurrency and resilience

- Webhook ingress performs minimal verification/persistence then queues reconciliation where safe.
- Event ID unique constraint prevents duplicates.
- Provider API calls use timeout/retry/circuit-breaker and are not required on ordinary entitlement checks.

## Security / correctness risks

- Do not store card data.
- Do not unlock paid features from query parameters or client state.
- Out-of-order webhook events require current-object reconciliation/version checks.

## Responsive and accessibility requirements

- All user-facing surfaces must define desktop, tablet and phone behavior rather than rely on accidental CSS wrapping.
- Critical actions must be keyboard reachable, have visible focus, semantic labels and non-color-only states.
- Loading, empty, error, permission-denied and offline/degraded states are part of the feature contract.

## Observability requirements

- Structured events for critical state transitions and failures.
- Latency/error metrics for service endpoints and external dependencies.
- Correlation/request IDs on support-visible failures; never log secrets or raw sensitive content.

## Test strategy

- Unit tests for domain rules and state transitions.
- Integration tests for persistence/provider boundaries.
- Authorization and tenant-isolation tests for every resource API.
- End-to-end tests for critical user journeys on desktop and mobile.
- Load/concurrency tests for high-frequency or contention-sensitive operations.

## Definition of Done

- [ ] Test mode covers successful checkout, failure, retry, cancellation, upgrade, duplicate webhook and out-of-order webhook.
- [ ] Entitlements update correctly without manual intervention.
- [ ] Payout/account setup is documented as an operational prerequisite, not hardcoded.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.