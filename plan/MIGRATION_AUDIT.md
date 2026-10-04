# Nexosophy Planning Migration & Deduplication Audit

## Why this file exists

The detailed ScholarForge planning set already contains a large amount of useful work. It must not be discarded, but it also must not be copied blindly into Nexosophy.

The legacy set contains a master orchestration document, a specification index, a canonical implementation sequence, focused module specifications, and phase execution documents. The correct migration strategy is **merge + rename + ownership cleanup**, not "write everything again."

## What is preserved

Preserve and migrate the detailed feature contracts for:

- universal editor;
- notes/infinite pages;
- whiteboard;
- calendar/reminders/tasks/notifications;
- student/course/study tools;
- thesis/references;
- laboratory/ELN;
- reporting/investigation;
- analysis;
- homepage/marketing;
- auth flows;
- pricing/billing UX;
- Stripe provider flow;
- Clerk provider flow;
- offline/PWA;
- integrations;
- security/operations.

The legacy plan's central principle is also preserved: Nexosophy is a unified recursive workspace, not disconnected mini-apps.

## What is replaced by the new GitHub architecture specs

The new Nexosophy specs under these folders are authoritative and absorb overlapping legacy material:

- `00-product-governance/`
- `01-foundation/`
- `02-identity-billing/`
- `03-data-content/`
- `04-api-scale/`

Legacy platform docs covering database/storage, API/background jobs, performance/scalability, provider-neutral auth/billing, observability or deployment are mined for missing requirements and then merged into these owners.

## Known duplicate/overlap areas

### Authentication

Legacy:
- Authentication/Login spec
- Sessions/security spec
- Clerk provider spec

Canonical ownership:
- Clerk/provider/session mechanics → `02-identity-billing/00-auth-clerk.md`
- internal user/profile lifecycle → `02-identity-billing/01-users-profiles-onboarding.md`
- workspace authorization → `02-identity-billing/02-workspaces-rbac-sharing.md`
- cross-cutting security hardening → quality/security spec

### Billing

Legacy:
- Pricing/Billing/Entitlements
- Stripe provider
- Phase 22 billing

Canonical ownership:
- pricing UI/copy → public pricing spec
- Stripe Checkout/Billing/Portal/webhooks → `02-identity-billing/03-stripe-billing.md`
- entitlements/quotas/admin support view → `02-identity-billing/04-entitlements-admin-billing.md`
- Phase 22 → execution order/checklist only

### Scalability

Legacy:
- API/background jobs
- performance/scalability
- observability/deployment

Canonical ownership:
- API contract → `04-api-scale/00-api-contract.md`
- horizontal scaling/concurrency → `04-api-scale/01-scalability-concurrency.md`
- rate limit/idempotency → `04-api-scale/02-rate-limit-idempotency.md`
- cache/queues/workers → `04-api-scale/03-cache-queues-workers.md`
- realtime → `04-api-scale/04-realtime-collaboration.md`
- SLO/load/capacity → `04-api-scale/05-performance-slo-capacity.md`
- WAF/abuse → `04-api-scale/06-abuse-ddos-waf.md`

### Content platform

Legacy files/folders, history/trash, search, import/export and media overlap with platform concerns. Canonical split:

- structural/persistence behavior → `03-data-content/`
- user-facing explorer/editor UX → `05-core-workspace/`

### Responsive/accessibility/security

These are cross-cutting requirements. Focused module specs state module-specific behavior only. They do not re-copy the entire global policy.

## Migration order

1. Freeze new spec creation.
2. Build this canonical map and Phase 00–24 sequence.
3. Migrate/rename the legacy specs required by Phases 00–06 first.
4. For each migrated spec:
   - change ScholarForge → Nexosophy;
   - update repository/domain references;
   - remove duplicated platform/provider ownership;
   - point to canonical architecture specs;
   - preserve detailed product behavior, responsive states, edge cases and acceptance tests.
5. Validate links.
6. Repeat by phase for 07–24.
7. Only then begin Phase 00 coding.

## Naming rule

All new canonical documentation uses **Nexosophy**. "ScholarForge" may remain only in historical migration notes until the migration is complete.

## Completion criteria for planning consolidation

- one `SPEC_INDEX.md`;
- one `IMPLEMENTATION_SEQUENCE.md`;
- one Phase 00–24 sequence;
- no two focused specs own the same state machine;
- every phase links to its owning specs;
- every owning spec declares data/API/permissions/responsive/scale/error/test behavior;
- all internal links validate;
- all product/provider names are Nexosophy/selected provider names;
- Phase 00 can be implemented without inventing architecture during coding.
