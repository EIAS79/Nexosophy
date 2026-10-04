# Phase 18 — Reporter, Investigations & Report Publishing

> **Canonical execution file:** `plan/13-phases/phase-18-reporting-investigations.md`

## Objective

Deliver evidence-heavy investigative and formal reporting workflows.

## Owning specifications

- [01-reporter-workspace.md](../09-reporting-analysis/01-reporter-workspace.md)
- [02-reports-authoring-publishing.md](../09-reporting-analysis/02-reports-authoring-publishing.md)
- [03-sources-interviews-evidence.md](../09-reporting-analysis/03-sources-interviews-evidence.md)
- [04-claims-fact-checking-timelines.md](../09-reporting-analysis/04-claims-fact-checking-timelines.md)

## Prerequisites

- [ ] Phase 17 passed.
- [ ] Rich editor/references/media/history/sharing stable.

## Required deliverables

- [ ] Story/investigation dossiers.
- [ ] Source/contact records with confidentiality classification.
- [ ] Interview notes/audio/transcripts boundary.
- [ ] Evidence items/provenance.
- [ ] Claim-evidence matrix.
- [ ] Fact-check status/reviewer notes.
- [ ] Investigation timelines.
- [ ] Formal report outline/sections.
- [ ] Review/approval/publication state machine.
- [ ] Redacted/exportable publication versions.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Confidential source fields excluded from unauthorized search/export.
- [ ] Publication cannot mutate released version silently.
- [ ] Redaction/export tests.
- [ ] Approval/review race conditions.

## Exit gate

- [ ] Evidence provenance survives edits/exports.
- [ ] Published versions are reproducible from approved state.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: