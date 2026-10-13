# Phase 14 — Student & Course System

> **Canonical execution file:** `plan/13-phases/phase-14-student-courses.md`

## Objective
Compose canonical content/productivity primitives into a complete student academic workspace.

## Prerequisites
- [x] Phase 13 implementation is available on the shared branch; formal combined validation is deferred.
- [x] Tasks/calendar/notes/templates are reused as canonical systems.

## Required deliverables
- [x] Academic terms/semesters with archive/rollover state.
- [x] Courses with code, credits, instructor metadata, syllabus/resource nodes and lecture/lab/tutorial sections.
- [x] Course-linked notes/resources/formulas through canonical content-node links.
- [x] Course meetings backed by canonical calendar events.
- [x] Assignments backed by canonical tasks with academic weight/rubric/submission metadata.
- [x] Exams backed by canonical calendar events with optional canonical revision tasks.
- [x] Study plans/topics and links to canonical focus sessions.
- [x] Grade items and course progress dashboard.
- [x] Flashcard deck hierarchy, basic/reverse/cloze/image models, source-node links and tags.
- [x] Versioned SM2-style scheduling abstraction with Again/Hard/Good/Easy grading, leech threshold and review log.
- [x] Due review queue and responsive review controls.
- [x] Academic starter template seeded into the Phase 12 template system.
- [x] Course dashboard with canonical links back to files/tasks/calendar.

## Integrity rules
- Academic metadata never replaces canonical task/calendar/content/focus records.
- Same course code may exist across different terms.
- Flashcard reviews append immutable before/after scheduling state.
- Course archive preserves linked canonical history/searchability.

## Required test matrix
- [ ] Semester rollover/archive.
- [ ] Timezone due dates and exam schedule.
- [ ] Spaced-repetition deterministic scheduling.
- [ ] Mobile quick capture/review.
- [ ] Cross-course permission/tenant isolation.
- [ ] Canonical task/calendar link integrity.

## Exit gate
- [x] A term can be modeled without duplicating tasks/calendar/files into shadow stores.
- [x] Academic objects reference canonical productivity/content IDs.
- [ ] Formal automated/responsive validation pending combined gate.

## Completion record
- Commit/PR: shared implementation branch; Phase 14 consolidated commit.
- Migration(s): `0013_academic.sql`.
- Staging deployment: intentionally deferred.
- Test evidence: CI/typecheck/lint/build/integration pending combined validation.
- Performance evidence: bounded course/dashboard lists and indexed due-card queue implemented; measured p95 pending.
- Deferred items: automated validation only.
- Approval/date: implementation deliverables completed 2026-10-09; validation approval pending.
