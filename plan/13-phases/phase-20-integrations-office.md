# Phase 20 — External Integrations & Office Editing

## Required deliverables
- [x] One-time OAuth state; Google/Microsoft PKCE.
- [x] AES-256-GCM encrypted token key ring and refresh rotation.
- [x] Google/Microsoft calendar synchronization with explicit mappings/conflicts.
- [x] Drive/OneDrive metadata linkage; explicit binary import remains Phase 05.
- [x] Mendeley reference import into canonical references.
- [x] Durable sync jobs, webhook dedupe and subscription renewal.
- [x] Disconnect clears credentials and revokes where provider supports it.
- [x] Office provider disabled by default; self-hosted ONLYOFFICE adapter.
- [x] Collabora preview-only until a separately approved WOPI host exists.
- [x] Office saves create new binary asset versions and re-enter asset scanning.
- [x] Responsive integrations UI.

## Exit gate
- [x] External providers are never authorization sources.
- [x] Stored credentials are revocable/deletable.
- [x] Sync state/conflicts are explicit.
- [ ] Automated OAuth/provider/security evidence pending combined gate.

## Completion record
- Migration: `0019_integrations_office.sql`.
- ADR: `plan/00-product-governance/adr/0013-integrations-office-boundary.md`.
- Staging/CI/typecheck/lint/build: deferred.
- Approval/date: implementation completed 2026-10-09; validation pending.
