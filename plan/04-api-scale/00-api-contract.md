# API Contract, Validation and Error Model

> **Plan path:** `plan/04-api-scale/00-api-contract.md`

## Purpose

Create a stable, typed, versioned API surface for web, mobile/PWA, workers and future integrations.

## Product outcomes

- Clients receive predictable responses/errors.
- Server authorization/validation is centralized and testable.
- API changes can roll out without breaking older clients.

## Required capabilities

- Versioned /v1 namespace.
- OpenAPI/JSON-schema generated from runtime validation.
- Consistent envelope only where useful; do not wrap streams/files.
- Cursor pagination.
- Stable machine-readable error codes.
- Request ID.
- Idempotency-Key support on selected mutations.
- ETag/version conditional writes for conflict-sensitive resources.
- Explicit deprecation policy.

## Routes / surfaces

- `/v1/*`

## Core data model

- `ApiError`
- `PageCursor`
- `IdempotencyRecord`

## Service / API contract

- 400 validation, 401 unauthenticated, 403 forbidden, 404 concealed/not found by policy, 409 conflict, 412 precondition, 422 domain validation, 429 rate limited, 503 dependency/saturation.
- Client never sends trusted user/workspace role; server resolves identity and authorization.

## Scale, concurrency and resilience

- Every list endpoint paginated.
- Avoid endpoint designs that cause client fan-out; provide aggregate/batch endpoints for dashboards.
- Compression and HTTP caching used appropriately.
- Payload size budgets documented for hot endpoints.

## Critical risks

- Inconsistent errors make retries unsafe.
- Offset pagination degrades on huge tables and mutating datasets.

## Responsive / accessibility

- User-facing flows must specify desktop, tablet and phone behavior.
- Keyboard, focus, semantic labeling and reduced-motion behavior are mandatory on critical paths.
- Loading, empty, denied, error and degraded states are designed, not improvised.

## Observability

- Structured logs with request/correlation IDs and redaction.
- Endpoint/job/provider latency, errors and saturation metrics.
- Alerts must be actionable and tied to a runbook.

## Testing

- Unit tests for domain rules.
- Integration tests for database/cache/queue/provider boundaries.
- Authorization/tenant-isolation tests.
- Concurrency/race tests where multiple writers are possible.
- Load tests for hot endpoints and expensive operations.

## Definition of Done

- [ ] OpenAPI generated in CI.
- [ ] Contract tests cover compatibility.
- [ ] API lint rules enforce auth, pagination and error conventions.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.