# Object Storage, Uploads and Media Delivery

> **Plan path:** `plan/03-data-content/02-object-storage-uploads.md`

## Purpose

Store large binaries outside PostgreSQL and keep upload/download traffic off core API instances.

## Product outcomes

- Users can upload large files reliably.
- API servers do not buffer large file bodies.
- Files are malware/type checked before becoming fully trusted.

## Required capabilities

- S3-compatible storage provider adapter.
- Multipart/resumable upload.
- Signed short-lived upload URLs.
- Upload session state in DB.
- Checksum/size/MIME verification.
- Virus/malware scanning workflow.
- Derivative generation for thumbnails/previews/audio waveforms.
- CDN-backed immutable object delivery.
- Private objects delivered through signed URLs/cookies.
- Deduplication only if privacy/security model allows it.

## Routes / surfaces

- `/upload`
- `/workspace/:id/files`

## Core data model

- `Asset`
- `UploadSession`
- `AssetVariant`
- `AssetScan`
- `StorageObject`

## Service / API contract

- POST /v1/uploads/initiate
- POST /v1/uploads/:id/complete
- POST /v1/assets/:id/download-url
- DELETE /v1/assets/:id

## Scale, concurrency and resilience

- Browser uploads directly to object storage using multipart uploads.
- API issues metadata/signatures only.
- Derivative processing runs in workers.
- Large downloads use CDN/object storage, not application proxy.
- Per-user/workspace upload concurrency and byte quotas prevent abuse.

## Critical risks

- Never trust client MIME/filename.
- Abandoned multipart uploads need lifecycle cleanup.
- Signed URLs must be scoped and short-lived.

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

- [ ] Resumable upload survives network interruption.
- [ ] Large-file load test does not increase API memory proportionally.
- [ ] Scan/quarantine and deletion lifecycle tests pass.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.