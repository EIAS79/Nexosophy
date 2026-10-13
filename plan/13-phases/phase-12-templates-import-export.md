# Phase 12 — Templates, Import & Export

> **Canonical execution file:** `plan/13-phases/phase-12-templates-import-export.md`

## Objective

Make Nexosophy reusable and portable rather than trapping content in proprietary structures.

## Owning specifications

- [05-import-export-conversion.md](../03-data-content/05-import-export-conversion.md)
- [13-templates.md](../05-core-workspace/13-templates.md)

## Prerequisites

- [x] Phase 11 implementation foundation available; formal combined validation is intentionally deferred.
- [x] Durable worker/storage pipeline is reused for bulk transfer work.

## Required deliverables

- [x] Template gallery and categories.
- [x] Save current content/subtree as personal or workspace template.
- [x] Versioned template snapshots with variables/default values.
- [x] Import wizard over trusted uploaded assets with explicit fidelity classification.
- [x] Workspace/node Nexosophy archive import.
- [x] Export single rich document, subtree, or workspace.
- [x] Portable manifest with hierarchy, metadata, tags, relations, rich/spatial content and explicit binary limitations.
- [x] Durable progress/retry/cancel/activity integration.
- [x] Private signed export downloads.
- [x] Export sanitization/redaction rules.
- [x] Nexosophy JSON and real ZIP archive formats.
- [x] Native text/Markdown/CSV/BibTeX/RIS import path.
- [x] Office/PDF/media preview-only classification unless an isolated converter is available.

## Reliability/security design

- Large bytes travel directly between worker and private object storage, never through normal API response bodies.
- Template/archive instantiation uses persistent source→new-node maps, making worker restart/resume repeat-safe.
- Internal object keys, checksums, auth/session secrets and stale asset identifiers are removed from portable manifests.
- Archive node IDs are remapped on import; canonical workspace permissions are re-established at the destination.
- Binary asset bytes are not silently embedded into portable JSON/ZIP archives; the manifest declares this fidelity limitation.
- Invalid/oversized/unsupported archives fail as bounded non-retryable jobs.

## Required test matrix

- [ ] Malformed/hostile import files.
- [ ] Large import/export worker restart.
- [ ] Partial failure/resume.
- [ ] Export permission/redaction regression.
- [ ] Round-trip hierarchy/relations test.

## Exit gate

- [x] Users have documented Nexosophy JSON/ZIP, Markdown and HTML export boundaries.
- [x] Long jobs execute through durable workers rather than request workers.
- [x] Fidelity labels are persisted and shown to users.
- [ ] Formal hostile-file/round-trip/restart validation pending combined CI tranche.

## Completion record

- Commit/PR: shared implementation branch; Phase 12 consolidated commit.
- Migration(s): `0011_templates_transfer.sql`.
- Staging deployment: intentionally deferred to avoid preview/deployment churn.
- Test evidence: CI/typecheck/lint/build/integration intentionally pending combined validation.
- Performance evidence: bounded archive limits, cursor-free durable progress checkpoints and private object-storage transfer boundaries implemented; measured staging evidence pending.
- Deferred items: automated validation gates only; PDF conversion requires configured isolated media processor.
- Approval/date: implementation deliverables completed 2026-10-09; validation approval pending.
