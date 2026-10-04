# Nexosophy Canonical Implementation Sequence

> **Canonical order:** Phase 00 → Phase 24.  
> **Rule:** do not start a dependent phase against fake persistence, fake authorization, temporary schemas, or infrastructure intended to be thrown away.

## Global sequencing rules

1. A phase closes only after its exit gate passes in staging.
2. Responsive/accessibility/security/observability/testing are part of every phase.
3. Later phases may extend earlier entities only through backward-compatible migrations.
4. Scale architecture is established before feature-heavy phases so hot endpoints do not require a backend rewrite later.
5. Billing has its own production phase before final hardening and launch.
6. Phase files orchestrate work; module specs own behavior.

## Phase 00 — Repository & engineering baseline

**Outcome:** monorepo, strict TypeScript, formatting/linting, package boundaries, environment validation, migration baseline, CI, preview/staging skeleton, logging/error baseline.

**Owners:** product governance, monorepo, environments, CI/CD, observability, Postgres baseline.

## Phase 01 — Design system, navigation & application shell

**Outcome:** design tokens/components, responsive app shell, desktop/tablet/mobile navigation, workspace switcher, public-site shell, dashboard shell, command palette baseline.

## Phase 02 — Authentication, accounts & security baseline

**Outcome:** Clerk integration, signup/signin, verification/recovery, Google/Microsoft OAuth where configured, internal user mapping, sessions/devices, security events, profile/settings baseline.

## Phase 03 — Workspaces, membership, RBAC & sharing

**Outcome:** workspace CRUD, memberships/invites, roles/permissions, owner/admin/member/viewer semantics, resource grants/share links, tenant-isolation tests.

## Phase 04 — PostgreSQL content model & recursive file/folder system

**Outcome:** universal node model, recursive tree/list, create/rename/move/copy, cycle-safe moves, breadcrumbs, lazy tree loading, workspace-scale indexes.

## Phase 05 — Object storage, uploads, media & previews

**Outcome:** signed direct uploads, resumable multipart, scan/quarantine, thumbnails/derivatives, private delivery, PDF/image/Office preview pipeline.

## Phase 06 — API scale foundation & rich document runtime

**Outcome:** typed API contract, cursor pagination, idempotency framework, Redis/rate limits, queue/worker infrastructure, universal editor runtime, rich document editor/autosave.

**Reason for placement:** high-concurrency infrastructure must exist before feature traffic multiplies.

## Phase 07 — History, trash, restore & audit

**Outcome:** version history, recoverable trash, restore/permanent-delete pipeline, privileged audit events.

## Phase 08 — Realtime collaboration & sharing experience

**Outcome:** CRDT/realtime transport, comments, mentions, presence, permission-safe room joins, reconnect/revocation behavior.

## Phase 09 — Notes, infinite pages & whiteboard

**Outcome:** notebooks/sections/pages, infinite/fixed page modes, ink/highlighter/lasso, media/audio anchors, whiteboard shapes/connectors, tablet/stylus UX.

## Phase 10 — Search, tags, relations & backlinks

**Outcome:** permission-safe search index, global search UX, tags, relations, backlinks, saved searches, command palette integration.

## Phase 11 — Tasks, reminders, calendar & notifications

**Outcome:** tasks/projects, RRULE recurrence, timezone-safe reminder scheduler, calendar day/week/month/agenda, notification center, dashboard integration.

## Phase 12 — Templates, import & export

**Outcome:** template gallery/save/apply, import jobs, export jobs, portable archive manifests, progress/retry/cancel.

## Phase 13 — Structured data, spreadsheets & code/notebooks

**Outcome:** structured database/table views, spreadsheet subset, formulas, code editor, computational notebook model, sandbox policy.

## Phase 14 — Student & course system

**Outcome:** terms/courses, linked notes/tasks/calendar, assignments, exams, study planning, flashcards/spaced repetition.

## Phase 15 — References, thesis & postgraduate research

**Outcome:** thesis/dissertation workspace, research questions/milestones, reference library, citations, literature review matrix.

## Phase 16 — Research & laboratory

**Outcome:** projects/ELN, protocols/SOPs, samples/reagents/inventory/lineage, equipment booking/maintenance, signatures/audit/compliance.

## Phase 17 — Professor, teaching & supervision

**Outcome:** teaching workspace, resource distribution, supervision roster, feedback/review workflows, office hours, controlled grade metadata.

## Phase 18 — Reporter / investigations / report publishing

**Outcome:** story dossiers, source vault, interviews/audio, evidence provenance, claim-evidence matrix, fact checking, timelines, reviewed report publishing.

## Phase 19 — Data analysis & visualization

**Outcome:** dataset ingestion/profile/cleaning, reproducible transformations, analysis notebook shell, charts and dashboards.

## Phase 20 — External integrations & Office editing

**Outcome:** selected calendar/drive/reference integrations, encrypted OAuth tokens, webhook sync/reconciliation, disconnect/revocation, Office provider integration if approved.

## Phase 21 — Offline/PWA & mobile hardening

**Outcome:** installable PWA, recent-document cache, offline mutation queue, sync/conflict UI, mobile/tablet regression hardening, restricted-workspace offline policy.

## Phase 22 — Payments, subscriptions & billing

**Outcome:** Stripe product/price mapping, Checkout, signed/idempotent webhooks, subscription/invoice/trial/failure/grace state machines, entitlements, Customer Portal, user/admin billing panels, VAT/tax path, payout/accounting runbooks.

**Critical rule:** browser return from Checkout is UI only; verified server-side Stripe state/webhooks are authoritative.

## Phase 23 — Production hardening & certification

**Outcome:** threat-model closure, penetration remediation, full accessibility audit, load/soak/spike tests, autoscaling validation, backup restore drill, provider-failure drills, incident runbooks, legal/privacy review, SLO dashboards.

**Initial capacity gate:** production-like environment must prove the agreed launch envelope, currently at least 1,000 sustained ordinary API req/s and 3,000 req/s short bursts with no data corruption and bounded DB connections; raise this before launch if forecasts require.

## Phase 24 — Staged production launch

**Stages:** internal alpha → invite-only technical alpha → higher-education/research beta → controlled public beta → GA.

**Outcome:** feature flags, rollout cohorts, monitoring, support/on-call, rollback, migration and feedback triage all operational.

## Build readiness

The planning gate has passed.

- `SPEC_INDEX.md` is reconciled.
- Legacy detailed specs have been migrated/renamed to Nexosophy.
- Duplicate source-of-truth ownership has been resolved.
- API/DB/auth/billing/storage/queue/search/realtime architecture has canonical owners.
- All 25 execution files exist.
- Phase 00 has explicit prerequisites, deliverables, tests and exit gates.

**Next action:** begin [Phase 00 — Repository & Engineering Baseline](13-phases/phase-00-repository-engineering-baseline.md).
