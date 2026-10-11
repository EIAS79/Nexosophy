# Phase 13 — Structured Databases, Spreadsheets & Code/Notebooks

> **Canonical execution file:** `plan/13-phases/phase-13-structured-data-code.md`

## Objective
Add structured and computational document types without breaking the universal content/editor model.

## Prerequisites
- [x] Phase 12 implementation is available on the shared branch; formal combined validation is deferred.
- [x] Specialized editor capability routing is active.

## Required deliverables
- [x] Structured sheet/database canonical model with sheets, typed columns, rows, named ranges, saved views and charts.
- [x] Table/grid view plus mobile card fallback; rows are server-paginated and bounded for virtualization.
- [x] Typed validation for number/boolean/date/select fields.
- [x] Safe formula parser/evaluator with dependency extraction and cycle rejection; no dynamic `eval`.
- [x] Saved table/board/calendar/gallery view model and filter/sort API.
- [x] Basic bar/line/pie chart configuration records.
- [x] CSV import is supported through Phase 12; XLSX is explicitly preview-only until a converter is configured.
- [x] Code document editor with language metadata, optimistic concurrency and specialized history.
- [x] Computational notebook cells with markdown/code source and separate output records.
- [x] Code execution disabled by default through immutable workspace execution policy; API returns explicit 403.
- [x] Notebook output size limit and source/output separation.
- [x] Specialized editors registered through the common editor registry.
- [x] Specialized history/outbox hooks for search/activity projection.

## Security/reliability
- No untrusted source code executes on API or worker hosts.
- Formula expressions use a bounded parser/function allowlist.
- Structured writes are server-authorized and version-aware.
- Specialized content keeps universal node identity, workspace RBAC, trash and relations.
- Per-cell ACL is not implied; permissions remain document/node scoped.

## Required test matrix
- [ ] Formula dependency/cycle automated suite.
- [ ] Large-table scroll/filter load test.
- [ ] Import inference/locale edge cases.
- [ ] Execution bypass/security test.
- [ ] Notebook output limits and concurrency.
- [ ] Responsive/keyboard acceptance.

## Exit gate
- [x] Structured/code/notebook content uses canonical node identity and export/search/history hooks.
- [x] Execution cannot be enabled or invoked through current client/API surfaces.
- [ ] Representative performance and automated security tests pending combined validation.

## Completion record
- Commit/PR: shared implementation branch; Phase 13 consolidated commit.
- Migration(s): `0012_structured_code_notebooks.sql`.
- Staging deployment: intentionally deferred.
- Test evidence: CI/typecheck/lint/build/integration pending combined validation.
- Performance evidence: bounded 200-row default reads, indexed row paging and responsive mobile cards implemented; measured p95 pending.
- Deferred items: production validation only; XLSX editable conversion and code execution remain intentionally unavailable without isolated converters/sandbox.
- Approval/date: implementation deliverables completed 2026-10-09; validation approval pending.
