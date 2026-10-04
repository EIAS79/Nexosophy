# Data Classification, Retention and Deletion

> **Plan path:** `plan/00-product-governance/05-data-classification-retention.md`

## Purpose

Define how user, academic, research, laboratory, billing and operational data are classified and retained.

## User / product outcomes

- Users can delete/export data predictably.
- Sensitive research and account data receives stronger controls than public content.

## Required capabilities

- Classification levels: public, internal, confidential, highly sensitive.
- Workspace retention policies.
- Trash retention window then hard-delete pipeline.
- Account deletion with legal/billing exceptions.
- Export package generation.
- Audit retention separated from document content where legally permitted.

## Routes / surfaces

- `/settings/privacy`
- `/settings/data`
- `/workspace/:id/settings/retention`

## Core data model

- `DataClassification`
- `RetentionPolicy`
- `DeletionJob`
- `ExportJob`
- `LegalHold`

## Service and API contract

- Deletion is asynchronous, resumable and auditable.
- Object-store deletion and search-index removal are reconciled after DB deletion markers.

## Scale, concurrency and resilience

- Bulk deletion/export runs through queues with chunking and rate control.
- Large exports stream to object storage and return signed download URLs.

## Security / correctness risks

- Hard deletion across derived indexes/caches is easy to miss; reconciliation jobs are mandatory.
- Backups have documented expiration semantics.

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

- [ ] Data lifecycle exists for each entity class.
- [ ] Deletion/export integration tests cover DB, object storage, search and cache.
- [ ] Privacy documentation matches actual behavior.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.