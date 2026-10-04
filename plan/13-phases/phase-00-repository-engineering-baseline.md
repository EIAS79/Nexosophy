# Phase 00 — Repository & Engineering Baseline

> **Canonical execution file:** `plan/13-phases/phase-00-repository-engineering-baseline.md`

## Objective

Create the production engineering skeleton that every later phase builds on. No product feature work belongs here.

## Owning specifications

- [00-product-vision.md](../00-product-governance/00-product-vision.md)
- [03-definition-of-done.md](../00-product-governance/03-definition-of-done.md)
- [04-architecture-decisions.md](../00-product-governance/04-architecture-decisions.md)
- [00-monorepo-structure.md](../01-foundation/00-monorepo-structure.md)
- [01-environments-configuration.md](../01-foundation/01-environments-configuration.md)
- [02-ci-cd-branching.md](../01-foundation/02-ci-cd-branching.md)
- [05-observability-foundation.md](../01-foundation/05-observability-foundation.md)
- [00-postgres-schema.md](../03-data-content/00-postgres-schema.md)

## Prerequisites

- [x] Canonical SPEC_INDEX and IMPLEMENTATION_SEQUENCE accepted.
- [x] Node/package-manager/runtime versions chosen and pinned.
- [x] Provider/environment naming convention agreed.

## Required deliverables

- [x] Initialize monorepo and package/workspace manager.
- [x] Create apps/web, apps/api, apps/worker, apps/realtime skeletons.
- [x] Create shared packages for ui, contracts, db, config, observability, auth, storage, billing, testing.
- [x] Strict TypeScript, linting, formatting, import-boundary rules and test runner.
- [x] Environment schema validation and .env.example without secrets.
- [x] Database migration tool and empty baseline migration.
- [x] Health/liveness/readiness endpoints.
- [x] Structured logger/request ID/error normalization baseline.
- [x] GitHub Actions PR checks and build cache.
- [x] Preview/staging deployment skeleton and artifact strategy.
- [x] Repository README, CONTRIBUTING and local bootstrap commands.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [x] Fresh-clone bootstrap on clean machine/container.
- [x] lint/typecheck/unit/build all pass.
- [x] Invalid environment variable causes startup failure with safe error.
- [x] Health/readiness behavior verified with dependency unavailable.
- [x] CI blocks intentionally broken lint/type/test.
- [x] No secret values appear in logs/build artifacts.

## Exit gate

- [x] One documented command installs and validates the repo.
- [ ] Main branch is releasable and CI-gated. **Engineering side is green; GitHub branch/ruleset enforcement remains an external repository-setting blocker because the connected GitHub integration does not expose write access for branch protection/rulesets.**
- [x] All four deployables build independently.
- [x] Database migration up/down or forward-recovery convention works.
- [x] Staging skeleton deploys without manual source edits.
- [x] No product feature implementation has leaked into Phase 00.

## Phase completion record

- Commit/PR: Phase 00 engineering baseline through `715aeb4fb62a1512b73f72defca977e02944fe31` plus subsequent documentation/deployment-artifact commits.
- Migration version(s): `0000_phase00_baseline.sql`; migration ledger + advisory lock; second-run idempotence verified.
- Staging deployment: provider-neutral staging contract in `infra/environments/staging/`; immutable SHA-tagged container strategy; all four container images built successfully.
- Test report:
  - CI Fast run `37243952987` — success.
  - Backend Integration run `37243876001` — success.
  - Fresh Clone Bootstrap run `37243950732` — success.
  - Container Smoke run `37243953008` — success.
  - Full Regression run `37244126231` — success.
  - Independent Build run `37243917776` — success.
- Load/performance evidence where applicable: not required for Phase 00 product traffic; capacity/load certification belongs to later scale/hardening phases.
- Known deferred items: GitHub branch/ruleset enforcement on `main` requires repository-setting write access not exposed by the connected GitHub integration. CI itself is active and green.
- Approval/date: engineering baseline verified 2026-10-04; phase exit remains administratively open only for branch/ruleset enforcement.