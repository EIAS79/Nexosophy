# Phase 20 — External Integrations & Office Editing

> **Canonical execution file:** `plan/13-phases/phase-20-integrations-office.md`

## Objective

Connect selected external providers through revocable adapters without making them canonical sources of Nexosophy authorization/business state.

## Owning specifications

- [01-external-integrations.md](../10-integrations-offline-ai/01-external-integrations.md)
- [04-office-editing-provider.md](../10-integrations-offline-ai/04-office-editing-provider.md)
- [05-import-export-conversion.md](../03-data-content/05-import-export-conversion.md)

## Prerequisites

- [ ] Phase 19 passed.
- [ ] Provider adapter/security patterns stable.

## Required deliverables

- [ ] OAuth connection framework with encrypted tokens.
- [ ] Selected calendar synchronization.
- [ ] Selected Drive/OneDrive file linkage/import boundaries.
- [ ] Reference-manager integrations where chosen.
- [ ] Webhook/subscription renewal/reconciliation.
- [ ] Disconnect/revoke/delete external credentials.
- [ ] Sync conflict strategy.
- [ ] ONLYOFFICE/Collabora or other Office provider integration only after licensing/security decision.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] OAuth token refresh/revocation.
- [ ] Webhook duplicate/out-of-order.
- [ ] Provider outage/degradation.
- [ ] Sync conflict/reconciliation.
- [ ] Disconnect removes future access.

## Exit gate

- [ ] No external provider becomes hidden source of permissions.
- [ ] All connected apps can be disconnected cleanly.
- [ ] Sync state is observable/reconcilable.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: