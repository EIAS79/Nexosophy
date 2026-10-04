# CI/CD, Branching and Release Promotion

> **Plan path:** `plan/01-foundation/02-ci-cd-branching.md`

## Purpose

Make every production change reproducible, reviewed and reversible.

## User / product outcomes

- Main remains releasable.
- Production promotion is gated by tests, migrations and health checks.

## Required capabilities

- Protected main branch.
- PR checks: lint, typecheck, unit, integration, security, build.
- Preview deployments.
- Staging promotion.
- Production canary/rolling release.
- Database migration gate.
- Rollback/redeploy workflow.
- Release notes.

## Routes / surfaces

- `N/A`

## Core data model

- `BuildArtifact`
- `MigrationArtifact`
- `Release`

## Service and API contract

- API compatibility checks prevent accidental breaking changes.
- Schema migration CI validates forward/backward compatibility during rolling deploys.

## Scale, concurrency and resilience

- Load/performance smoke tests run on staging for high-risk API changes.
- Worker and API versions support safe overlap during rollout.

## Security / correctness risks

- Deploying code that requires an already-completed destructive migration breaks rolling instances.
- Never run irreversible destructive migrations in the same step as feature rollout.

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

- [ ] Required checks block merge.
- [ ] Staging and production use immutable artifacts.
- [ ] Rollback path tested.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.