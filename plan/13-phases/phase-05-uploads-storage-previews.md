# Phase 05 — Uploads, Object Storage, Media & Previews

> **Canonical execution file:** `plan/13-phases/phase-05-uploads-storage-previews.md`

## Objective

Implement durable binary storage and preview pipelines without routing large file bytes through core API servers.

## Owning specifications

- [02-object-storage-uploads.md](../03-data-content/02-object-storage-uploads.md)
- [05-import-export-conversion.md](../03-data-content/05-import-export-conversion.md)
- [03-cache-queues-workers.md](../04-api-scale/03-cache-queues-workers.md)

## Prerequisites

- [x] Phase 04 exit gate passed.
- [ ] Object-storage development/staging buckets configured.
- [ ] Worker queue operational.

## Required deliverables

- [x] Asset and UploadSession schema.
- [x] Signed multipart/resumable direct-upload flow.
- [x] Checksum/size/type verification.
- [x] Scan/quarantine hook and trust states.
- [x] Image thumbnail/preview workers.
- [x] PDF preview/text extraction boundary.
- [x] Office file preview/convert strategy and fidelity labels.
- [x] Audio/video metadata and waveform/thumbnail jobs where supported.
- [x] Private signed delivery URLs/CDN strategy.
- [x] Upload quota/concurrency enforcement.
- [x] Abandoned upload cleanup lifecycle.
- [x] Progress/retry/cancel UI integrated with file explorer.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Interrupted multipart upload resume.
- [ ] Oversize/disallowed MIME rejection.
- [ ] Malicious/malformed file quarantine path.
- [ ] Worker restart during derivative generation.
- [ ] Large uploads do not scale API memory with file size.
- [ ] Signed URL expiry/access test.
- [ ] Concurrent upload quota enforcement.

## Exit gate

- [ ] Application API handles metadata/signatures, not large object streams.
- [ ] Uploaded asset cannot become trusted before validation/scan policy.
- [ ] Preview failures do not corrupt canonical file/node state.
- [ ] Storage/worker failures are observable and recoverable.

## Phase completion record

- Commit/PR: implementation staged on branch `phases-05-07-storage-editor-history`; merge intentionally deferred until the combined Phase 05–10 validation tranche.
- Migration version(s): `0004_assets_uploads.sql`.
- Staging deployment: deferred to the combined Phase 05–10 validation/staging pass.
- Test report: required test matrix intentionally remains open until the combined Phase 05–10 CI/integration run.
- Load/performance evidence where applicable: direct browser-to-object-storage multipart flow is implemented so API memory is independent of object size; formal load evidence is deferred.
- Known deferred items (must not violate exit gate): external development/staging object-storage bucket credentials and scanner/media processor endpoints must be configured in deployment secrets before the exit gate can be evaluated.
- Approval/date: implementation deliverables completed in the shared Phase 05–07 branch; phase validation/approval intentionally deferred.