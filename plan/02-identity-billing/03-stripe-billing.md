# Stripe Payments & Subscriptions — Canonical Nexosophy Specification

> This file is the single owner of Stripe Checkout, Billing, Customer Portal, webhooks, merchant operations and payout flow. Product entitlement rules live in `04-entitlements-admin-billing.md`.

# Stripe Payments, Subscriptions, Billing Portal & Merchant Money Flow

> Status: normative provider implementation specification.
>
> This document converts the provider-agnostic billing architecture into a concrete Stripe implementation for production. If Stripe is ever replaced, the domain contracts in `06-pricing-billing.md` remain stable while this provider adapter is swapped.

**Master plan:** [`../README.md`](../README.md)  
**Parent billing spec:** [`06-pricing-billing.md`](04-entitlements-admin-billing.md)  
**Delivery phase:** Phase 22 — Payments, subscriptions & billing  
**Related systems:** authentication, workspaces, entitlements, email, notifications, audit, analytics, support/admin, accounting

---

## 1. Provider decision

**Primary payment and subscription provider: Stripe.**

Use these Stripe products/capabilities:

- Stripe Checkout — Stripe-hosted checkout page for initial purchases and plan changes that require payment confirmation.
- Stripe Billing — recurring subscriptions, prices, billing periods, trials, invoices, dunning/retries.
- Stripe Customer Portal — hosted self-service billing management.
- Stripe Tax or configured tax handling — VAT/tax calculation where the business/legal configuration requires it.
- Stripe webhooks — authoritative asynchronous billing events.
- Stripe Dashboard — merchant operations, payouts, disputes, refunds, invoice/payment inspection, tax configuration, support investigation.
- Stripe Radar/default fraud controls — fraud/risk layer where applicable.
- Stripe test mode + Stripe CLI — local/integration testing.

Do **not** use Stripe Connect for the normal Nexosophy subscription model. Nexosophy is the merchant selling its own SaaS. Connect is only introduced later if Nexosophy becomes a marketplace that pays third-party sellers/providers.

---

## 2. Merchant/account ownership model

Nexosophy's production Stripe account belongs to the legal business operating Nexosophy.

The merchant account must be configured with:

- legal company name;
- registered address;
- company/tax identifiers required by Stripe;
- verified business representative/owner information;
- support email/site/business information;
- statement descriptor;
- refund/cancellation policy URLs;
- privacy policy and terms URLs;
- production domain(s);
- linked business bank account for payouts;
- payout schedule;
- supported settlement currencies;
- tax registrations where legally required.

Secrets and dashboard access belong to the business, not to an individual developer account.

Production Stripe access requires MFA and least privilege for staff.

---

## 3. Exact money flow

```text
Nexosophy pricing page
        |
        v
POST /api/billing/checkout-session
        |
        | authenticated user/workspace + selected internal plan price key
        v
Nexosophy backend
        |
        | validate eligibility, ownership, current subscription, currency
        | map internal price key -> Stripe Price ID
        | create/reuse Stripe Customer
        | create Stripe Checkout Session
        v
HTTPS redirect to Stripe-hosted Checkout
        |
        | user enters/chooses payment method on Stripe
        | Stripe processes/authorizes payment
        v
Stripe
   |                      |
   | browser redirect     | signed webhook events
   v                      v
/billing/success     /api/webhooks/stripe
   |                      |
   | UI only              | verify signature
   | NOT proof            | idempotent event processing
   | of payment           | reconcile subscription/customer/invoice
   |                      | update internal BillingAccount/Subscription
   |                      | recompute entitlements
   |                      | audit + notifications
   v                      v
"Confirming payment" -> ACTIVE when backend confirms provider state

Stripe merchant balance
        |
        | Stripe payout schedule
        v
Nexosophy legal business bank account
```

The browser redirect **never** activates paid access by itself.

Paid access is granted only after server-side verification via signed Stripe event handling and/or direct Stripe API reconciliation.

---

## 4. Customer ownership model

### 4.1 Individual subscriptions

One internal billing account represents the billable individual.

Recommended mapping:

```text
Internal User
  -> BillingAccount(scope=PERSONAL)
  -> stripe_customer_id
  -> Subscription
```

A user can own only one active primary personal subscription unless product strategy explicitly supports multiple independent billing scopes.

### 4.2 Workspace/team subscriptions

```text
Workspace
  -> BillingAccount(scope=WORKSPACE)
  -> billing_owner_user_id
  -> stripe_customer_id
  -> Subscription
  -> purchased_seat_quantity
```

The billing owner/admin controls billing, but entitlement checks apply to the workspace and its members.

### 4.3 Institution contracts

Large institution billing may be:

- Stripe subscription;
- Stripe invoice/quote flow;
- negotiated contract with manual invoicing;
- procurement purchase order workflow.

All cases still normalize to internal `BillingAccount`, `Subscription/Contract`, `EntitlementGrant`, and invoice/payment status records.

---

## 5. Product and price catalog

Stripe Product/Price objects are provider configuration, not the application's authorization source.

Internal catalog tables:

```text
Plan
PlanVersion
PlanPrice
EntitlementDefinition
PlanEntitlement
```

`PlanPrice` fields include:

- id
- plan_version_id
- market/region
- currency
- billing_interval (`month`, `year`)
- amount_minor
- tax_behavior
- seat_mode
- active_from
- active_until
- provider = `stripe`
- stripe_product_id
- stripe_price_id
- environment (`test`, `live`)

Never hardcode Stripe Price IDs directly throughout UI/business code.

Use stable internal price keys such as:

```text
individual.monthly.pln.v1
individual.annual.pln.v1
team.monthly.eur.v1
team.annual.eur.v1
```

A configuration service maps internal keys to environment-specific Stripe IDs.

---

## 6. Checkout flow

### 6.1 Entry points

Checkout may start from:

- `/pricing`
- `/settings/billing`
- `/workspace/:workspaceId/settings/billing`
- trial expiry prompt
- quota upgrade prompt
- seat expansion action

### 6.2 Backend checkout endpoint

`POST /api/billing/checkout-session`

Request contains only application identifiers, never a raw client-provided Stripe Price ID as authority.

Example logical request:

```json
{
  "billingScope": "workspace",
  "workspaceId": "w_...",
  "priceKey": "team.annual.pln.v1",
  "seatQuantity": 8,
  "returnPath": "/workspace/w_.../settings/billing"
}
```

Server validates:

- authenticated user;
- billing permission;
- workspace membership;
- plan availability;
- plan transition legality;
- seat quantity bounds;
- currency/region availability;
- no duplicate incompatible checkout already pending;
- validated internal return path;
- promotion/trial eligibility.

Server creates or retrieves Stripe Customer, then Checkout Session.

Persist a `CheckoutAttempt` before redirecting.

### 6.3 Checkout Session metadata

Attach immutable correlation metadata such as:

- internal billing account ID;
- user/workspace ID;
- checkout attempt ID;
- internal plan/price key;
- environment marker.

Never put secrets or unnecessary personal data in metadata.

### 6.4 Redirect handling

Nexosophy redirects the browser to the exact Stripe-hosted session URL returned by the server.

Success URL:

`/billing/success?session_id={CHECKOUT_SESSION_ID}`

Cancel URL:

`/billing/cancelled?attempt=<opaque-id>`

The success page shows:

1. `Confirming your subscription…`
2. polls/streams internal billing status for a short bounded period;
3. transitions to active state when backend confirms;
4. provides a safe fallback `Refresh status` action;
5. never asks user to pay again while the prior attempt is unresolved.

---

## 7. Payment methods

Use Stripe dynamic payment method configuration unless a specific method is intentionally restricted.

Expected baseline:

- cards;
- Apple Pay / Google Pay when available through supported Stripe flows;
- Link;
- locally relevant methods where Stripe supports them for the selected currency, country, and recurring model.

For Poland, BLIK can be exposed only where Stripe supports the exact transaction/subscription behavior required. The implementation must not assume every one-time payment method supports recurring subscriptions.

The UI must distinguish:

- available for one-time payment;
- available for recurring subscription;
- reusable mandate/payment method;
- asynchronous payment state.

Nexosophy never stores PAN/CVC/raw card details.

---

## 8. Customer Portal flow

Billing settings contains **Manage billing in Stripe**.

Flow:

```text
User clicks Manage billing
 -> POST /api/billing/portal-session
 -> backend verifies billing permission
 -> backend creates short-lived Stripe Customer Portal session
 -> redirect browser to Stripe portal URL
 -> user manages payment method/invoices/subscription
 -> Stripe webhooks update Nexosophy
 -> portal return URL returns to Nexosophy billing settings
```

Portal capabilities configured intentionally:

- update billing details;
- update payment methods;
- view/download invoices;
- cancel at period end;
- optional immediate cancellation only where product policy permits;
- plan switching only for supported transitions;
- tax ID management where applicable.

Do not iframe the Customer Portal.

---

## 9. Subscription state machine

Internal normalized states:

```text
NONE
CHECKOUT_PENDING
TRIALING
ACTIVE
PAST_DUE
GRACE
RESTRICTED
CANCEL_AT_PERIOD_END
CANCELED
INCOMPLETE
INCOMPLETE_EXPIRED
PAUSED
```

Store the raw provider status separately from normalized product state.

State transition rules must be explicit and tested.

Entitlements are derived from normalized internal state, plan, grace policy, and overrides—not directly from a frontend Stripe object.

---

## 10. Webhook endpoint

Endpoint:

`POST /api/webhooks/stripe`

Requirements:

- receive raw request body as required for signature verification;
- verify Stripe signature with environment-specific webhook secret;
- reject invalid signatures;
- persist event ID before processing;
- deduplicate by provider event ID;
- respond quickly after durable acceptance;
- perform expensive work asynchronously;
- tolerate out-of-order delivery;
- tolerate duplicated delivery;
- reconcile current object state from Stripe when ordering is ambiguous;
- dead-letter unrecoverable failures;
- alert after repeated processing failure.

Never expose this endpoint behind normal user session authentication.

Authentication is webhook signature verification.

---

## 11. Required webhook/event coverage

At minimum design handlers/reconciliation for events representing:

- checkout completion;
- subscription creation;
- subscription update;
- subscription cancellation/deletion;
- invoice creation/finalization where relevant;
- invoice paid/payment succeeded;
- invoice payment failed;
- trial approaching end;
- payment method changes where business logic depends on them;
- refunds/chargebacks/disputes where access or accounting must react.

Implementation uses the currently supported Stripe event names/API version at build time and pins/tests the Stripe API version.

Do not make business logic depend on a single event when multiple event sequences can legally occur.

---

## 12. Idempotency and concurrency

Every provider mutation from Nexosophy uses a deterministic Stripe idempotency key when retries are possible.

Examples:

```text
checkout:<checkoutAttemptId>
portal:<billingAccountId>:<requestNonce>
subscription-change:<changeRequestId>
refund:<refundRequestId>
```

Webhook processing transaction pattern:

1. insert event receipt if unseen;
2. lock relevant billing account/subscription row;
3. compare provider object version/timestamps;
4. reconcile canonical provider state;
5. update internal normalized state;
6. recompute entitlements;
7. write audit event;
8. enqueue notifications/accounting events;
9. mark provider event processed.

---

## 13. Database entities

### 13.1 BillingAccount

Fields include:

- id
- scope_type (`PERSONAL`, `WORKSPACE`, `INSTITUTION`)
- scope_id
- billing_owner_user_id
- provider
- provider_customer_id
- country
- preferred_currency
- billing_email
- legal_name
- tax_id_reference/normalized tax metadata where appropriate
- created_at/updated_at

### 13.2 Subscription

- id
- billing_account_id
- provider_subscription_id
- plan_version_id
- plan_price_id
- normalized_status
- provider_status
- quantity
- current_period_start/end
- trial_start/end
- cancel_at_period_end
- canceled_at
- grace_until
- provider_snapshot_version/hash
- created_at/updated_at

### 13.3 Invoice

Store application-needed metadata and provider references, not a shadow accounting system unless required.

- provider_invoice_id
- billing_account_id
- subscription_id
- number/reference
- currency
- subtotal/tax/total/amount_due/amount_paid
- status
- hosted_invoice_url
- invoice_pdf_url/reference
- period
- provider timestamps

### 13.4 PaymentMethodReference

Store safe provider descriptors only:

- provider payment method ID
- type
- brand where provided
- last4 where provided
- expiry month/year where provided
- default flag

No raw card credentials.

### 13.5 BillingEvent

Immutable internal event/audit record for billing lifecycle transitions.

### 13.6 ProviderWebhookEvent

- provider event ID
- type
- received_at
- processed_at
- processing status
- attempt count
- failure classification
- minimal retained payload/reference according to privacy policy

---

## 14. Entitlement activation

Stripe does not decide application authorization directly.

Pipeline:

```text
Stripe state
 -> provider adapter
 -> normalized Subscription
 -> PlanVersion
 -> PlanEntitlements
 -> effective EntitlementSet
 -> server-side authorization/quota checks
```

Cache entitlements only with deterministic invalidation.

Critical write paths always enforce plan limits server-side.

---

## 15. Upgrades

Upgrade flow decides whether transition is:

- immediate with proration;
- immediate without proration;
- scheduled for period end;
- requires new Checkout confirmation.

Before mutation show:

- old plan;
- new plan;
- effective date;
- seat count;
- current-period credit/charge estimate if available;
- tax implications;
- renewal date;
- currency.

Server creates a `SubscriptionChangeRequest` so a double click cannot create duplicate changes.

---

## 16. Downgrades

Downgrade requires preflight against:

- current storage;
- workspace member count;
- premium integrations;
- history retention;
- AI allowance;
- premium collaboration features;
- lab/reporting capabilities where applicable.

Never delete user data solely to satisfy a downgrade.

If over quota after downgrade:

- preserve read/export access;
- block relevant new writes/uploads;
- show concrete remediation actions.

---

## 17. Cancellation

Default consumer/self-service behavior:

- cancel at period end;
- keep paid entitlement through current paid period;
- clearly show cancellation effective date;
- allow reactivation before effective cancellation when Stripe/product state permits.

Immediate cancellation/refund is an explicit support/admin action according to refund policy.

No dark patterns.

---

## 18. Failed payments and dunning

On payment failure:

```text
ACTIVE
 -> PAST_DUE
 -> GRACE (configured duration)
 -> ACTIVE if recovered
 -> RESTRICTED/CANCELED according to policy if not recovered
```

During grace:

- banner in app;
- billing owner notification;
- Stripe-managed retry/dunning where configured;
- `Update payment method` action opens Customer Portal;
- no destructive data deletion.

Restriction policy must be entitlement-specific rather than making the entire account unusable.

---

## 19. Trials

Trial state records:

- trial source/campaign;
- eligible scope;
- started_at;
- ends_at;
- whether payment method required;
- converted/canceled/expired outcome.

Trial eligibility is enforced server-side to prevent repeated self-service trial abuse.

Notifications before trial end must respect communication preferences where legally/product appropriate.

---

## 20. Coupons, promotions, student discounts

Promotion support is optional by launch market but architecture supports:

- Stripe promotion/coupon IDs;
- internal campaign code;
- eligibility rule;
- redemption limits;
- time window;
- specific plan/price applicability;
- stacking policy;
- audit trail.

Never trust client-visible coupon metadata as authorization for a discount.

Student pricing, if introduced, needs verification policy separate from Stripe payment processing.

---

## 21. Taxes, VAT and invoices

Production launch requires legal/accounting review for the merchant entity and markets served.

Implementation supports:

- customer country/location collection as required;
- business vs consumer billing details;
- VAT/tax ID collection and validation where supported;
- tax-inclusive/exclusive price display by market policy;
- invoice/receipt availability;
- stored provider tax/invoice references;
- tax reporting exports required by accounting workflow.

Do not hardcode tax rates in application code.

If Stripe Tax is enabled, tax configuration is environment-controlled and validated with test scenarios before live mode.

---

## 22. Currency strategy

Initial market configuration should explicitly define supported currencies.

Recommended architecture supports at least:

- PLN for Polish market;
- EUR for broader EU pricing;
- additional currencies only after pricing/legal review.

Each plan price is a specific immutable amount/currency/version.

Do not convert prices client-side using live FX and then charge the converted amount without a defined pricing policy.

---

## 23. Merchant payout behavior

Customer payments are processed into the Nexosophy Stripe merchant balance, less provider fees/refunds/disputes as applicable.

Stripe then pays eligible funds to the verified business bank account according to the Stripe payout schedule and account configuration.

Nexosophy application code does **not** manually transfer each subscriber payment to the owner's personal account.

Operational finance should reconcile:

- Stripe balance transactions;
- payouts;
- refunds;
- disputes;
- invoices;
- internal subscription records;
- accounting ledger/imports.

The production bank destination must be the correct business account according to the merchant's legal/accounting setup.

---

## 24. User billing panel

Routes:

- `/settings/billing`
- `/settings/billing/invoices`
- `/workspace/:workspaceId/settings/billing`

Panel sections:

1. current plan/status;
2. renewal/cancellation date;
3. billing scope (personal/workspace);
4. usage vs quotas;
5. upgrade/downgrade;
6. seats for team plan;
7. payment method summary;
8. invoices;
9. billing contact;
10. tax information summary;
11. `Manage billing in Stripe`;
12. cancellation/reactivation;
13. support link.

Sensitive provider identifiers are never shown unnecessarily.

---

## 25. Internal admin/support billing panel

Route example:

`/admin/billing`

Restricted to authorized internal operational roles.

Capabilities:

- search billing account by internal user/workspace ID, verified email, or Stripe customer ID;
- see normalized subscription status;
- see provider IDs with direct Stripe Dashboard link for authorized staff;
- see latest invoices/payments status;
- see webhook health and last reconciliation;
- see entitlement calculation;
- see grace/restriction state;
- trigger safe reconciliation from Stripe;
- record support note/audit event;
- create approved refund action only if business policy permits and authorization requires step-up/confirmation;
- never edit a paid subscription by directly changing database status.

Provider-backed mutations go through service methods and provider API, then reconcile.

---

## 26. Stripe Dashboard responsibility boundary

Use Stripe Dashboard for:

- payout/bank configuration;
- legal business verification;
- payment detail inspection;
- disputes;
- refunds where operationally approved;
- tax configuration;
- invoice/provider operations;
- webhook endpoint monitoring;
- product/price operational inspection;
- live/test mode management.

Use Nexosophy admin for:

- product entitlement interpretation;
- workspace/user context;
- support workflow;
- audit trail;
- internal reconciliation status;
- feature/quota impact.

Do not rebuild Stripe Dashboard poorly inside Nexosophy.

---

## 27. Authentication and billing binding

Checkout requires a signed-in Nexosophy identity except for future intentionally designed guest purchase flows.

Binding rules:

- internal user ID is authoritative application identity;
- Clerk ID maps to internal user ID;
- billing account maps to user/workspace;
- Stripe Customer ID maps to billing account;
- email is descriptive/contact data, not the durable join key.

Never identify a Stripe customer solely by matching email at entitlement time.

---

## 28. API/service boundaries

Recommended services:

```text
BillingCatalogService
BillingAccountService
StripeCustomerService
CheckoutService
CustomerPortalService
SubscriptionService
InvoiceService
EntitlementService
BillingReconciliationService
StripeWebhookService
BillingNotificationService
BillingAdminService
```

Provider adapter interface:

```text
PaymentProvider
  createCustomer(...)
  createCheckoutSession(...)
  createPortalSession(...)
  retrieveSubscription(...)
  updateSubscription(...)
  cancelSubscription(...)
  retrieveInvoice(...)
  verifyWebhook(...)
```

Business services depend on `PaymentProvider`; Stripe implementation satisfies it.

---

## 29. Required endpoints

Representative API map:

```text
GET    /api/billing/catalog
GET    /api/billing/account
POST   /api/billing/checkout-session
GET    /api/billing/checkout-attempt/:id
POST   /api/billing/portal-session
POST   /api/billing/subscription/change
POST   /api/billing/subscription/cancel
POST   /api/billing/subscription/reactivate
GET    /api/billing/invoices
GET    /api/billing/usage
POST   /api/webhooks/stripe

GET    /api/admin/billing/accounts/:id
POST   /api/admin/billing/accounts/:id/reconcile
POST   /api/admin/billing/refunds/:paymentId   # only if enabled by policy
```

Exact REST/RPC shape may change; domain boundaries do not.

---

## 30. Secrets and environment configuration

Required separation:

```text
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_API_VERSION
STRIPE_PRICE_* mappings or secure catalog configuration
STRIPE_PORTAL_CONFIGURATION_ID if using explicit configuration
```

Rules:

- never commit secrets;
- never expose secret key to browser;
- separate test/live keys;
- separate test/live webhook endpoints/secrets;
- production secret access restricted;
- secret rotation documented/tested;
- preview environments must never charge live cards.

---

## 31. Logging and privacy

Log:

- internal correlation IDs;
- provider object IDs where operationally useful;
- event type;
- normalized transition;
- processing outcome;
- latency/error classification.

Do not log:

- full card information;
- CVC;
- secrets;
- webhook signatures;
- full sensitive payloads by default;
- unnecessary billing addresses/tax identifiers.

---

## 32. Observability

Metrics:

- checkout sessions created;
- checkout conversion;
- checkout abandoned/expired;
- webhook processing success/failure/latency;
- subscription activation latency;
- active/trialing/past-due/canceled counts;
- failed payment recovery;
- provider API error rate;
- reconciliation drift count;
- portal session creation errors;
- invoice payment failures;
- refund/dispute counts where appropriate.

Alerts:

- webhook endpoint failures;
- sustained provider API failures;
- unexpected entitlement drift;
- event processing backlog;
- live webhook secret mismatch;
- abnormal checkout failure spike.

---

## 33. Reconciliation jobs

Webhooks are primary but not the sole consistency mechanism.

Scheduled reconciliation:

- recently changed subscriptions;
- unresolved checkout attempts;
- past-due subscriptions;
- webhook failures/dead-letter records;
- sampled active subscriptions for drift detection;
- invoice/payment status inconsistencies.

Reconciliation never silently overwrites internal state without audit.

---

## 34. Responsive UX

### Desktop

Billing settings may use two-column layout: plan/usage on left, payment/invoices/actions on right.

### Tablet

Collapse to one primary column with grouped cards; tables become horizontally constrained cards or compact lists.

### Mobile

- one column;
- 44px+ touch targets;
- plan comparison uses stacked cards;
- invoice table becomes list rows;
- sticky/clear CTA only when it does not obscure content;
- redirect-to-Stripe transition shows progress state;
- returning from Stripe restores exact billing context;
- no critical details hidden in hover states.

---

## 35. Accessibility

- pricing cards are semantic regions/list items;
- current plan announced clearly;
