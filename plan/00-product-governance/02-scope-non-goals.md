# Scope, Boundaries and Non-Goals

> **Plan path:** `plan/00-product-governance/02-scope-non-goals.md`

## Purpose

Prevent uncontrolled scope and define which integrations are native, embedded, imported or delegated to specialist providers.

## User / product outcomes

- Engineering knows what must be first-class and what is intentionally delegated.
- Product decisions remain consistent across phases.

## Required capabilities

- Native: content tree, notes/editors, search, tasks/calendar/reminders, academic/research/reporting/lab records, collaboration, history, permissions.
- Integrated: authentication, payments, email delivery, object storage, external calendar sync and optional cloud drives.
- Imported/exported rather than cloned: full Microsoft/Google office suites and specialist statistical packages.

## Routes / surfaces

- `/plan-only`

## Core data model

- `ArchitectureDecisionRecord`

## Service and API contract

- Provider integrations sit behind adapters.
- External service failure must degrade gracefully where possible.

## Scale, concurrency and resilience

- Avoid synchronous dependency chains across providers on hot API paths.
- Use webhooks and background reconciliation for provider state.

## Security / correctness risks

- Attempting perfect file-format parity with Microsoft Office in v1 is unrealistic; define supported fidelity tiers.
- Do not build a custom payment processor or identity provider.

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

- [ ] Each major feature is classified native/integrated/imported/deferred.
- [ ] Unsupported behaviors have explicit user-facing fallback paths.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.