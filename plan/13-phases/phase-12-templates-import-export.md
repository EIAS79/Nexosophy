# Phase 12 — Templates, Import & Export

> **Canonical execution file:** `plan/13-phases/phase-12-templates-import-export.md`

## Objective

Make Nexosophy reusable and portable rather than trapping content in proprietary structures.

## Owning specifications

- [05-import-export-conversion.md](../03-data-content/05-import-export-conversion.md)
- [13-templates.md](../05-core-workspace/13-templates.md)

## Prerequisites

- [ ] Phase 11 passed.
- [ ] Worker/storage pipeline production-ready for bulk jobs.

## Required deliverables

- [ ] Template gallery and categories.
- [ ] Save current content/workspace structure as template subject to policy.
- [ ] Template variable/default values.
- [ ] Import wizard with fidelity classification.
- [ ] Workspace/node archive import.
- [ ] Export single document/folder/workspace.
- [ ] Portable manifest with hierarchy/metadata/relations where supported.
- [ ] Progress/retry/cancel/activity integration.
- [ ] Export redaction/permission rules.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Malformed/hostile import files.
- [ ] Large import/export worker restart.
- [ ] Partial failure/resume.
- [ ] Export respects permissions and redactions.
- [ ] Round-trip archive hierarchy test.

## Exit gate

- [ ] Users can leave with documented portable formats.
- [ ] Long jobs never tie up request workers.
- [ ] Fidelity limitations are explicit.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: