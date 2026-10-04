# Phase 15 — References, Thesis & Postgraduate Research

> **Canonical execution file:** `plan/13-phases/phase-15-postgraduate-references.md`

## Objective

Deliver literature/citation and thesis workflows for Master's, PhD and research-heavy users.

## Owning specifications

- [04-postgraduate-thesis-research.md](../07-academic/04-postgraduate-thesis-research.md)
- [05-references-literature-citations.md](../07-academic/05-references-literature-citations.md)
- [03-rich-document-editor.md](../05-core-workspace/03-rich-document-editor.md)

## Prerequisites

- [ ] Phase 14 passed.
- [ ] Rich editor/search/import/export stable.

## Required deliverables

- [ ] Thesis/dissertation project workspace.
- [ ] Research questions/hypotheses/objectives.
- [ ] Milestones/supervision meetings.
- [ ] Reference library and metadata.
- [ ] DOI/identifier import boundaries.
- [ ] PDF/reference attachment linking.
- [ ] Citation insertion and bibliography generation.
- [ ] Citation style abstraction.
- [ ] Literature review matrix.
- [ ] Annotations/notes linked back to sources.
- [ ] BibTeX/RIS import/export.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Duplicate-reference merge.
- [ ] Citation renumber/update correctness.
- [ ] Broken/missing metadata recovery.
- [ ] Bibliography export fidelity.
- [ ] Large reference library search.

## Exit gate

- [ ] Citations are traceable to canonical reference records.
- [ ] Thesis content/history/export remains independent of citation provider availability.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: