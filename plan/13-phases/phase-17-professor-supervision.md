# Phase 17 — Professor, Teaching & Supervision

> **Canonical execution file:** `plan/13-phases/phase-17-professor-supervision.md`

## Objective
Compose course, document, review and calendar primitives for instructors and supervisors.

## Required deliverables
- [x] Teaching workspace over canonical academic courses.
- [x] Instructor/assistant/student/supervisee roster with explicit revocation.
- [x] Resource distribution with draft/scheduled/released/withdrawn visibility.
- [x] Assignment rubric/light-grade feedback boundary.
- [x] Student reads exclude all unreleased feedback/grade metadata.
- [x] Supervision relationships, milestones and shared/private meeting-note boundary.
- [x] Office-hour windows/bookings with capacity-safe serialization.
- [x] Responsive teaching/course/supervision UI.

## Required test matrix
- [ ] Student cannot see unreleased feedback/grade fields.
- [ ] Supervisor access revocation.
- [ ] Bulk resource distribution.
- [ ] Roster scale/performance.

## Exit gate
- [x] Instructor/student visibility is explicit in server queries.
- [x] Private supervisor notes are not projected to supervisees.
- [ ] Automated permission/performance evidence pending combined gate.

## Completion record
- Migration: `0016_teaching_supervision.sql`.
- Staging deployment: deferred.
- Validation: CI/typecheck/lint/build/integration intentionally deferred.
- Approval/date: implementation completed 2026-10-09; validation pending.
