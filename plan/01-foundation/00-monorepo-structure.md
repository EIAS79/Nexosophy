# Monorepo and Codebase Structure

> **Plan path:** `plan/01-foundation/00-monorepo-structure.md`

## Purpose

Define a repository layout that supports web, API, workers, shared packages and infrastructure without circular ownership.

## User / product outcomes

- Developers know where each concern belongs.
- Shared types/contracts are reused without coupling UI to persistence internals.

## Required capabilities

- apps/web
- apps/api
- apps/worker
- apps/realtime
- packages/ui
- packages/contracts
- packages/db
- packages/auth
- packages/billing
- packages/storage
- packages/search
- packages/observability
- packages/config
- packages/testing
- infra

## Routes / surfaces

- `N/A`

## Core data model

- `Package boundary`

## Service and API contract

- OpenAPI/typed contracts generated from server schemas.
- Domain services own business logic; route handlers stay thin.

## Scale, concurrency and resilience

- API/worker/realtime deploy independently so each can autoscale by its own pressure signal.
- No background queue consumption inside web frontend processes.

## Security / correctness risks

- A monorepo can become a monolith without package boundaries and dependency rules.
- Avoid premature service explosion; modularize first, split only on operational need.

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

- [ ] Workspace tooling, lint, typecheck, tests and build graph are configured.
- [ ] Dependency rules prevent frontend packages importing server-only code.
- [ ] Each deployable has health/readiness endpoints.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.