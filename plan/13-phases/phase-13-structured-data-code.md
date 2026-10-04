# Phase 13 — Structured Databases, Spreadsheets & Code/Notebooks

> **Canonical execution file:** `plan/13-phases/phase-13-structured-data-code.md`

## Objective

Add structured and computational document types without breaking the shared editor/content model.

## Owning specifications

- [08-spreadsheets-tables-databases.md](../05-core-workspace/08-spreadsheets-tables-databases.md)
- [09-code-notebooks.md](../05-core-workspace/09-code-notebooks.md)
- [02-editor-platform.md](../05-core-workspace/02-editor-platform.md)

## Prerequisites

- [ ] Phase 12 passed.
- [ ] Universal editor capability model supports specialized runtimes.

## Required deliverables

- [ ] Structured table/database document model.
- [ ] Table/grid, filtered/sorted/grouped views.
- [ ] Typed columns and validation.
- [ ] Formula engine supported subset.
- [ ] CSV/XLSX import/export fidelity policy.
- [ ] Code text editor with syntax/language metadata.
- [ ] Computational notebook cell model.
- [ ] Execution disabled by default unless sandbox architecture is approved.
- [ ] Outputs/artifacts stored separately from executable source.
- [ ] Large table virtualization.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Formula dependency/cycle tests.
- [ ] Large-table scrolling/filtering.
- [ ] Import type inference edge cases.
- [ ] Untrusted code cannot execute on normal API/worker hosts.
- [ ] Notebook output size/resource limits.

## Exit gate

- [ ] Structured data remains searchable/exportable/history-aware.
- [ ] Execution policy cannot be bypassed from client.
- [ ] Performance budget holds for representative large datasets.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: