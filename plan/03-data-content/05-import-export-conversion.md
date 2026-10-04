# Import, Export and File Conversion

> **Plan path:** `plan/03-data-content/05-import-export-conversion.md`

## Purpose

Allow users to enter and leave Nexosophy with common formats while making conversion fidelity explicit.

## Product outcomes

- Users can import supported files into native or attachment form.
- Users can export documents/workspaces in portable formats.
- Long conversions do not block API requests.

## Required capabilities

- Import adapters for Markdown, TXT, PDF, DOCX, PPTX, XLSX/CSV, images, audio and supported citation formats.
- Export to Markdown/PDF/HTML/ZIP plus domain formats where applicable.
- Workspace archive export with manifest.
- Conversion fidelity tiers: native editable, partially editable, preview-only.
- Progress/cancel/retry for long jobs.

## Routes / surfaces

- `/import`
- `/export`
- `node menus`

## Core data model

- `ImportJob`
- `ExportJob`
- `ConversionArtifact`

## Service / API contract

- POST /v1/imports
- GET /v1/imports/:id
- POST /v1/exports
- GET /v1/exports/:id

## Scale, concurrency and resilience

- Files land in object storage then workers parse/convert.
- CPU/memory-heavy converters run in isolated worker pools with per-job resource limits.
- Bulk imports are chunked and resumable.

## Critical risks

- Untrusted office/PDF files must be sandboxed/scanned.
- Do not claim perfect office fidelity where unsupported.

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

- [ ] Supported format matrix documented.
- [ ] Malformed/hostile file tests exist.
- [ ] Large import/export jobs survive worker restart and expose status.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.