# Phase 15 — References, Thesis & Postgraduate Research

> **Canonical execution file:** `plan/13-phases/phase-15-postgraduate-references.md`

## Objective
Deliver long-running thesis/research planning and a traceable canonical reference/citation system.

## Prerequisites
- [x] Phase 14 implementation is available on the shared branch; combined validation remains deferred.
- [x] Rich documents, tasks/calendar, assets, search and portability foundations are reused.

## Required deliverables
- [x] Thesis/dissertation projects with proposal document and canonical research-file tree.
- [x] Research questions, hypotheses and objectives.
- [x] Chapter documents with explicit status/ordering.
- [x] Milestones backed by canonical tasks.
- [x] Supervisor records and meetings backed by canonical calendar events plus meeting-note documents.
- [x] Decision log, ethics/approval tracker, dataset/experiment links and submission/viva checklist.
- [x] Canonical reference library with authors, DOI/ISBN/PMID/arXiv identifiers, attachments and metadata.
- [x] Identifier normalization/provider-independent resolution boundary.
- [x] Workspace-scoped identifier uniqueness and duplicate detection.
- [x] Duplicate merge preserving citations, annotations, attachments, collections, identifiers and literature-matrix data.
- [x] PDF/reference asset linking to trusted Phase 05 assets.
- [x] Citation styles abstraction with APA 7, IEEE and Harvard renderers.
- [x] Citation instances anchored to canonical reference IDs and inserted into rich documents with document checkpoints.
- [x] Bibliography generation by document or whole library.
- [x] Literature collections and literature-review matrix.
- [x] Source-linked annotations/quotes/page locators.
- [x] Actual BibTeX and RIS parser/import/export.
- [x] Rich-document citation picker and responsive research/reference UI.

## Integrity/security rules
- Citation anchors always reference stable canonical reference IDs.
- DOI/identifier uniqueness is tenant-scoped, never global.
- External metadata providers are optional adapters; research/history/export remain usable without them.
- Thesis milestones/meetings reuse canonical task/calendar records instead of shadow scheduling stores.
- Reference merge is auditable and preserves dependent records.
- Citation insertion checkpoints the prior document revision before mutation.

## Required test matrix
- [ ] Duplicate DOI/identifier cases across and within workspaces.
- [ ] Citation deletion/merge/update behavior.
- [ ] BibTeX/RIS malformed/large imports.
- [ ] Citation style golden fixtures.
- [ ] Large reference-library search/pagination.
- [ ] Thesis permission/tenant isolation and supervisor-change workflows.

## Exit gate
- [x] Thesis projects compose canonical content/task/calendar primitives.
- [x] Citations remain traceable to source references.
- [x] BibTeX/RIS round-trip paths are implemented.
- [ ] Formal citation-style/import/scale/security validation pending combined gate.

## Completion record
- Commit/PR: shared implementation branch; Phase 15 consolidated commit.
- Migration(s): `0014_thesis_references.sql`.
- Staging deployment: intentionally deferred.
- Test evidence: CI/typecheck/lint/build/integration pending combined validation.
- Performance evidence: indexed references/identifiers/citations and bounded 500-record library operations implemented; production p95 pending.
- Deferred items: automated validation only; live DOI/ISBN/PMID metadata provider adapters remain optional integration work rather than a source-of-truth dependency.
- Approval/date: implementation deliverables completed 2026-10-09; validation approval pending.
