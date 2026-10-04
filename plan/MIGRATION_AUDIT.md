# Nexosophy Planning Migration & Deduplication Audit

> **Status:** COMPLETE  
> **Result:** legacy ScholarForge planning has been migrated, normalized and reconciled into the canonical Nexosophy plan structure.

## What was migrated

The detailed prior planning work was preserved where it added real product depth, including:

- universal editor runtime and rich documents;
- notes, infinite pages, ink and whiteboards;
- tasks, reminders, calendar and notifications;
- student/course/study workflows;
- Master's/PhD and references/citations;
- research/ELN/protocols/inventory/equipment;
- reporter/investigation/reports/evidence/fact-checking;
- datasets, analysis notebooks and visualizations;
- public homepage and pricing;
- Clerk authentication;
- Stripe subscriptions/payments/payout flow;
- offline/PWA, integrations and AI assistance;
- security, testing, backup/disaster recovery and production operations.

## Canonical ownership after deduplication

| Concern | Canonical owner |
|---|---|
| Clerk auth, sessions, MFA/passkeys, provider webhooks | `02-identity-billing/00-auth-clerk.md` |
| Internal users/profiles | `02-identity-billing/01-users-profiles-onboarding.md` |
| Workspaces/RBAC/sharing | `02-identity-billing/02-workspaces-rbac-sharing.md` |
| Stripe Checkout/Billing/Portal/webhooks/payout path | `02-identity-billing/03-stripe-billing.md` |
| Entitlements/quotas/admin billing | `02-identity-billing/04-entitlements-admin-billing.md` |
| Pricing page/customer-facing billing UX | `11-public-website/03-pricing.md` |
| PostgreSQL/content/storage/history/search infrastructure | `03-data-content/` |
| API contract/scale/rate limits/queues/realtime/SLOs | `04-api-scale/` |
| User-facing explorer/editor/note/document behavior | `05-core-workspace/` |
| Tasks/reminders/calendar/notifications | `06-productivity/` |
| Academic/student/postgraduate/professor workflows | `07-academic/` |
| Research/laboratory workflows | `08-research-lab/` |
| Reporting/investigation/analysis | `09-reporting-analysis/` |
| Integrations/offline/AI/Office provider boundary | `10-integrations-offline-ai/` |
| Homepage/features/pricing/legal/help/status/SEO | `11-public-website/` |
| Security/testing/backup/incident operations | `12-quality-security/` |
| Build sequencing only | `13-phases/` |

Repeated explanatory references may remain where they improve local readability, but there are no unresolved competing sources of truth for the state machines/providers above.

## Phase numbering reconciliation

The final sequence contains exactly **25 phases: Phase 00 through Phase 24**.

The old sequence ended at Phase 23 before billing was split into its own production phase. The canonical sequence is now:

- Phase 22 — Payments, subscriptions & billing
- Phase 23 — Production hardening & certification
- Phase 24 — Staged production launch

All canonical execution files use this numbering.

## Naming reconciliation

- Product name: **Nexosophy**
- Repository: **EIAS79/Nexosophy**
- Target public domain: **nexosophy.com**
- Authentication provider: **Clerk**
- Payment/subscription provider: **Stripe**

The old product name may appear only in this historical migration explanation. It is not used as an active product or repository identifier elsewhere in the canonical plan.

## Link and structure audit

Audit completed across:

- the canonical root planning files;
- all **85 focused module specifications**;
- all **25 phase execution files**.

Issues found and repaired during migration included stale provider cross-links inherited from the old folder layout and one pricing-to-Stripe link. Canonical phase/index execution links were validated after repair.

## Capability coverage audit

The product vision requires:

- recursive workspaces/files;
- rich documents;
- infinite notes;
- whiteboards;
- spreadsheets/datasets;
- code/notebooks;
- tasks/reminders/calendar/notifications;
- templates/search/import/export;
- academic/student workflows;
- Master's/PhD/references;
- research/laboratory workflows;
- professor/supervision workflows;
- reporting/investigation;
- analysis;
- collaboration;
- subscription/billing;
- responsive desktop/tablet/phone support.

Every item above has at least one canonical focused specification and an implementation phase.

## Completion criteria

- [x] One canonical `SPEC_INDEX.md`.
- [x] One canonical `IMPLEMENTATION_SEQUENCE.md`.
- [x] Exactly Phase 00–24.
- [x] Canonical ownership reconciled for auth, billing, realtime, search, Office, security and scale.
- [x] Every phase has an execution contract.
- [x] Focused product specifications migrated and organized by domain.
- [x] Product renamed to Nexosophy in active planning.
- [x] Canonical root/phase/module link audit completed and discovered stale links repaired.
- [x] Product-vision capabilities mapped to canonical specs/phases.
- [x] Phase 00 can begin without inventing the baseline architecture during coding.

## Final disposition

**Planning consolidation is complete.**

Further changes to the plan are now treated as normal architecture/product revisions and must not block Phase 00 unless they change a dependency or release-critical invariant.
