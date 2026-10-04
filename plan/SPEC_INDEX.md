# Nexosophy Canonical Specification Index

> **Purpose:** one authoritative map of product specifications.  
> **Rule:** a concept has one owning specification. Other documents link to it; they do not redefine it.

## Status legend

- ✅ **EXISTS** — already created in `EIAS79/Nexosophy`.
- 🔁 **MIGRATE** — detailed ScholarForge spec exists in the uploaded plan and must be renamed/rebased to Nexosophy, merged with current architecture, and committed here.
- ✍️ **WRITE** — no complete focused spec exists yet; create after migration/deduplication.

## 00 — Product governance

- ✅ `00-product-governance/00-product-vision.md`
- ✅ `00-product-governance/01-personas-workflows.md`
- ✅ `00-product-governance/02-scope-non-goals.md`
- ✅ `00-product-governance/03-definition-of-done.md`
- ✅ `00-product-governance/04-architecture-decisions.md`
- ✅ `00-product-governance/05-data-classification-retention.md`
- 🔁 Product foundation/scope details from the legacy master plan are merged into these files; no second product-foundation spec will be kept.

## 01 — Foundation & experience

- ✅ `01-foundation/00-monorepo-structure.md`
- ✅ `01-foundation/01-environments-configuration.md`
- ✅ `01-foundation/02-ci-cd-branching.md`
- ✅ `01-foundation/03-design-system-responsive.md`
- ✅ `01-foundation/04-accessibility-i18n.md`
- ✅ `01-foundation/05-observability-foundation.md`
- 🔁 Information architecture / navigation / application shell
- 🔁 Public homepage / marketing architecture
- 🔁 Authenticated home dashboard
- 🔁 Onboarding / first-run
- 🔁 Settings / preferences / personalization

## 02 — Identity, access & billing

- ✅ `02-identity-billing/00-auth-clerk.md` — **provider implementation owner: Clerk**
- ✅ `02-identity-billing/01-users-profiles-onboarding.md`
- ✅ `02-identity-billing/02-workspaces-rbac-sharing.md`
- ✅ `02-identity-billing/03-stripe-billing.md` — **provider implementation owner: Stripe**
- ✅ `02-identity-billing/04-entitlements-admin-billing.md`
- 🔁 Session/device/account-security details migrate into auth/security specs rather than creating a competing auth source of truth.
- 🔁 Sharing/guest/public-link details expand the RBAC/sharing spec.
- 🔁 Pricing-page product UX is owned by the public website/pricing spec; payment mechanics remain in Stripe billing.

## 03 — Data & content platform

- ✅ `03-data-content/00-postgres-schema.md`
- ✅ `03-data-content/01-recursive-files-folders.md`
- ✅ `03-data-content/02-object-storage-uploads.md`
- ✅ `03-data-content/03-history-trash-audit.md`
- ✅ `03-data-content/04-search-indexing.md`
- ✅ `03-data-content/05-import-export-conversion.md`
- 🔁 Tags, relations, backlinks and knowledge graph extend search/content relationships rather than becoming a separate database.
- 🔁 Templates are a product module but use the same universal-node/content infrastructure.

## 04 — API, scale & realtime

- ✅ `04-api-scale/00-api-contract.md`
- ✅ `04-api-scale/01-scalability-concurrency.md`
- ✅ `04-api-scale/02-rate-limit-idempotency.md`
- ✅ `04-api-scale/03-cache-queues-workers.md`
- ✅ `04-api-scale/04-realtime-collaboration.md`
- ✅ `04-api-scale/05-performance-slo-capacity.md`
- ✅ `04-api-scale/06-abuse-ddos-waf.md`
- 🔁 Legacy API/background-jobs, performance/scalability and realtime material is merged into these owners, not duplicated.

## 05 — Core workspace & editors

- 🔁 Application shell/navigation integration
- 🔁 File explorer & workspace tree UI
- 🔁 Universal editor platform / document runtime
- 🔁 Rich document editor
- 🔁 Notes / notebooks / infinite pages / ink
- 🔁 Whiteboard / visual canvas
- 🔁 Media / attachments / recording / embeds
- 🔁 PDF & Office viewers/editing strategy
- 🔁 Spreadsheets / tables / structured databases
- 🔁 Code files / computational notebooks
- 🔁 Templates / reusable content
- 🔁 Comments / mentions / collaborative review

## 06 — Productivity

- 🔁 Tasks / projects / focus sessions
- 🔁 Reminders / scheduler
- 🔁 Calendar / recurrence / timezone behavior
- 🔁 Notifications / inbox / activity
- 🔁 Command palette / quick capture / global actions

## 07 — Academic

- 🔁 Student courses / terms / academic workspace
- 🔁 Assignments / exams / study planning
- 🔁 Flashcards / spaced repetition
- 🔁 Master's / PhD thesis & research workspace
- 🔁 References / literature review / citations
- 🔁 Professor teaching / supervision

## 08 — Research & laboratory

- 🔁 Research projects / ELN
- 🔁 Protocols / SOPs / method versioning
- 🔁 Samples / reagents / inventory / lineage
- 🔁 Equipment / booking / maintenance
- 🔁 Laboratory compliance / signatures / traceability / audit

## 09 — Reporting & analysis

- 🔁 Reporter / investigative workspace
- 🔁 Reports authoring / review / publishing
- 🔁 Sources / interviews / evidence
- 🔁 Claims / fact checking / timelines
- 🔁 Datasets / data cleaning
- 🔁 Analysis workflows / notebooks
- 🔁 Visualizations / dashboards
- 🔁 Product usage analytics / experimentation

## 10 — Integrations, offline & AI

- 🔁 External integrations / connected apps
- 🔁 Offline synchronization / PWA
- 🔁 AI assistance / suggestions
- 🔁 Office-editing provider strategy

## 11 — Public website & growth

- 🔁 Homepage / marketing site
- 🔁 Feature / persona landing pages
- 🔁 Pricing page / plan comparison / CTA flow
- 🔁 Login / signup surface integration
- ✍️ Legal/privacy/terms/cookie page implementation
- ✍️ Help center / support
- ✍️ Status page / incident communication
- 🔁 SEO / analytics / conversion tracking

## 12 — Quality, security & operations

- 🔁 Security / privacy / compliance architecture
- 🔁 Testing strategy / CI quality gates
- ✅ scale/performance ownership lives under `04-api-scale/`; this folder only owns certification/runbooks, not duplicate architecture
- 🔁 Deployment / environments / backup / disaster recovery
- ✍️ Incident response / on-call
- ✍️ Production operations / release / rollback
- ✍️ Penetration-test and security-hardening checklist

## 13 — Delivery phases

Exactly **25 phases: Phase 00 through Phase 24**.

Phase files are execution checklists only. They do **not** redefine module behavior. Each phase links to the owning focused specs.

See `../IMPLEMENTATION_SEQUENCE.md`.

## Ownership rule

Examples:

- Clerk mechanics → `02-identity-billing/00-auth-clerk.md`
- Stripe mechanics → `02-identity-billing/03-stripe-billing.md`
- Entitlements/quotas → `02-identity-billing/04-entitlements-admin-billing.md`
- Pricing page UX → public website/pricing spec
- Universal editor runtime → core workspace editor spec
- Notes-specific behavior → notes spec
- API rate limiting → `04-api-scale/02-rate-limit-idempotency.md`
- Load targets/capacity → `04-api-scale/05-performance-slo-capacity.md`
- Phase files → sequence, prerequisites, deliverables, tests, exit gate only

If two specs appear to own the same state machine or entity, stop and reconcile ownership before coding.
