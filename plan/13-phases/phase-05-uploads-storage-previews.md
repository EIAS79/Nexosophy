# Phase 05 — Uploads, Object Storage, Media & Previews

> **Canonical execution file:** `plan/13-phases/phase-05-uploads-storage-previews.md`

## Objective

Implement durable binary storage and preview pipelines without routing large file bytes through core API servers.

## Owning specifications

- [02-object-storage-uploads.md](../03-data-content/02-object-storage-uploads.md)
- [05-import-export-conversion.md](../03-data-content/05-import-export-conversion.md)
- [03-cache-queues-workers.md](../04-api-scale/03-cache-queues-workers.md)

## Prerequisites

- [ ] Phase 04 exit gate passed.
- [ ] Object-storage development/staging buckets configured.
- [ ] Worker queue operational.

## Required deliverables

- [ ] Asset and UploadSession schema.
- [ ] Signed multipart/resumable direct-upload flow.
- [ ] Checksum/size/type verification.
- [ ] Scan/quarantine hook and trust states.
- [ ] Image thumbnail/preview workers.
- [ ] PDF preview/text extraction boundary.
- [ ] Office file preview/convert strategy and fidelity labels.
- [ ] Audio/video metadata and waveform/thumbnail jobs where supported.
- [ ] Private signed delivery URLs/CDN strategy.
- [ ] Upload quota/concurrency enforcement.
- [ ] Abandoned upload cleanup lifecycle.
- [ ] Progress/retry/cancel UI integrated with file explorer.

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

- Commit/PR:
- Migration version(s):
- Staging deployment:
- Test report:
- Load/performance evidence where applicable:
- Known deferred items (must not violate exit gate):
- Approval/date: