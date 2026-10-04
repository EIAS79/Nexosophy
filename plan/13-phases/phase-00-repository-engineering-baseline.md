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

- [ ] Canonical SPEC_INDEX and IMPLEMENTATION_SEQUENCE accepted.
- [ ] Node/package-manager/runtime versions chosen and pinned.
- [ ] Provider/environment naming convention agreed.

## Required deliverables

- [ ] Initialize monorepo and package/workspace manager.
- [ ] Create apps/web, apps/api, apps/worker, apps/realtime skeletons.
- [ ] Create shared packages for ui, contracts, db, config, observability, auth, storage, billing, testing.
- [ ] Strict TypeScript, linting, formatting, import-boundary rules and test runner.
- [ ] Environment schema validation and .env.example without secrets.
- [ ] Database migration tool and empty baseline migration.
- [ ] Health/liveness/readiness endpoints.
- [ ] Structured logger/request ID/error normalization baseline.
- [ ] GitHub Actions PR checks and build cache.
- [ ] Preview/staging deployment skeleton and artifact strategy.
- [ ] Repository README, CONTRIBUTING and local bootstrap commands.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Fresh-clone bootstrap on clean machine/container.
- [ ] lint/typecheck/unit/build all pass.
- [ ] Invalid environment variable causes startup failure with safe error.
- [ ] Health/readiness behavior verified with dependency unavailable.
- [ ] CI blocks intentionally broken lint/type/test.
- [ ] No secret values appear in logs/build artifacts.

## Exit gate

- [ ] One documented command installs and validates the repo.
- [ ] Main branch is releasable and CI-gated.
- [ ] All four deployables build independently.
- [ ] Database migration up/down or forward-recovery convention works.
- [ ] Staging skeleton deploys without manual source edits.
- [ ] No product feature implementation has leaked into Phase 00.

## Phase completion record

- Commit/PR:
- Migration version(s):
- Staging deployment:
- Test report:
- Load/performance evidence where applicable:
- Known deferred items (must not violate exit gate):
- Approval/date: