# Phase 16 — Research & Laboratory

> **Canonical execution file:** `plan/13-phases/phase-16-research-laboratory.md`

## Objective
Provide an auditable electronic research/laboratory workspace built on existing content, tasks, storage and permissions.

## Prerequisites
- [x] Phase 15 source implementation is present; formal combined validation remains deferred.
- [x] Workspace/RBAC/history/audit/content/storage primitives are reused.

## Required deliverables
- [x] Research project hierarchy, classifications, restricted membership and responsive project dashboard.
- [x] Experiments with objectives, hypotheses, planning/status and versioned runs.
- [x] ELN canonical document nodes, timestamped observations and cross-record links.
- [x] ELN sign/lock with SHA-256 content hash, independent witness and append-only signatures.
- [x] Signed ELN body, observations and links are immutable; amendments create separate canonical records.
- [x] Versioned protocols/SOPs with steps/materials/hazards, approvals and acknowledgements.
- [x] Approved protocol versions/steps are immutable and historical runs pin the exact protocol-version ID.
- [x] Samples, storage hierarchy, barcode metadata and cycle-protected parent/child lineage.
- [x] Reagent/consumable inventory, lots, expiry, SDS links and hazard metadata.
- [x] Row-locked inventory adjustments, reservations, unit conversion and negative-stock prevention.
- [x] FEFO lot recommendation, quarantine/recall/disposal and explicit location moves.
- [x] Equipment registry, training records, serialized booking conflict checks and usage check-in/out.
- [x] Maintenance/calibration records, booking conflict protection and calibration/training validity checks.
- [x] Deduplicated expiry/low-stock/calibration/maintenance alerts through the transactional outbox.
- [x] Policies, versioned acknowledgement evidence, retention configuration, legal holds and access reviews.
- [x] Append-only lab integrity stream and operational compliance exports with explicit non-certification disclaimer.
- [x] ELN and SOP starter templates.
- [x] Responsive project/ELN/protocol/inventory/equipment/compliance UI.

## Security and integrity
- Restricted project rows require explicit project membership in addition to workspace authorization.
- Signed ELN records cannot be overwritten; amendment is the recovery path.
- Inventory transaction and integrity/signature records are append-only.
- Sample lineage cycles are rejected in PostgreSQL.
- Equipment overlap checks are transactionally serialized per equipment/workspace.
- Compliance export deliberately does **not** claim legal/regulatory certification.

## Required test matrix
- [ ] Concurrent inventory adjustment.
- [ ] Sample lineage integrity.
- [ ] Protocol version used by historical experiment cannot silently change.
- [ ] Equipment booking conflict.
- [ ] Signature/amendment audit integrity.
- [ ] Restricted-project tenant/member authorization.
- [ ] Alert deduplication and worker restart.

## Exit gate
- [x] Lab records have explicit provenance/versioning in canonical schema.
- [x] No compliance claim exceeds implemented controls.
- [x] Critical audit/signature/inventory history is append-only by database trigger.
- [ ] Automated integration/security/concurrency evidence pending combined CI gate.

## Completion record
- Commit/PR: consolidated Phase 16–21 implementation commit.
- Migration: `0015_research_laboratory.sql`.
- Staging deployment: intentionally deferred to avoid preview-deployment churn.
- Test evidence: CI/typecheck/lint/build/integration intentionally deferred by instruction.
- Performance evidence: bounded dashboard queries and worker alert batches implemented; measured p95 pending validation.
- Deferred items: automated validation evidence only.
- Approval/date: implementation completed 2026-10-09; validation pending.
