# Phase 16 — Research & Laboratory

> **Canonical execution file:** `plan/13-phases/phase-16-research-laboratory.md`

## Objective

Provide an auditable electronic research/laboratory workspace built on existing content, tasks, storage and permissions.

## Owning specifications

- [01-research-projects-eln.md](../08-research-lab/01-research-projects-eln.md)
- [02-protocols-sops.md](../08-research-lab/02-protocols-sops.md)
- [03-samples-reagents-inventory.md](../08-research-lab/03-samples-reagents-inventory.md)
- [04-equipment-booking-maintenance.md](../08-research-lab/04-equipment-booking-maintenance.md)
- [05-lab-compliance-audit.md](../08-research-lab/05-lab-compliance-audit.md)

## Prerequisites

- [ ] Phase 15 passed.
- [ ] Workspace/RBAC/history/audit primitives stable.

## Required deliverables

- [ ] Research project hierarchy and ELN entries.
- [ ] Protocols/SOPs with version approval.
- [ ] Experiment runs and parameter/result records.
- [ ] Samples, parents/children/aliquots and lineage.
- [ ] Reagents/lots/expiry/storage.
- [ ] Inventory adjustments with audit.
- [ ] Equipment records, booking, maintenance/calibration.
- [ ] Attachments/images/data links.
- [ ] Sign/lock/amend behavior where policy requires.
- [ ] Lab templates and compliance exports.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Concurrent inventory adjustment.
- [ ] Sample lineage integrity.
- [ ] Protocol version used by historical experiment cannot silently change.
- [ ] Equipment booking conflict.
- [ ] Signature/amendment audit integrity.

## Exit gate

- [ ] Lab records have explicit provenance/versioning.
- [ ] No compliance claim exceeds implemented controls.
- [ ] Critical audit trail is append-only and tested.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: