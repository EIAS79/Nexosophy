# Phase 21 — Offline/PWA & Mobile Hardening

> **Canonical execution file:** `plan/13-phases/phase-21-offline-pwa-mobile.md`

## Objective
Make core document/task/attachment workflows resilient to connectivity loss while preventing plaintext caching of authenticated workspace content.

## Prerequisites
- [x] Phase 20 source implementation is present in the consolidated tree; formal validation remains deferred.
- [x] Document/task optimistic version semantics are reused by offline replay.

## Required deliverables
- [x] Installable web manifest and service worker.
- [x] AES-GCM encrypted IndexedDB document/task snapshot cache.
- [x] Encrypted offline mutation queue with replay-safe operation IDs.
- [x] Document-save queue compaction prevents stale duplicate offline revisions.
- [x] Task create/update/complete replay; recurring completion preserves canonical server semantics.
- [x] Sync status and explicit server/client conflict resolution UI.
- [x] Online reconnect and Background Sync replay signal.
- [x] Workspace offline/attachment/background-sync policy and per-device quota.
- [x] Device registration, usage reporting and revocation.
- [x] Explicit encrypted attachment pin/unpin/open flow; no implicit attachment caching.
- [x] Service worker never caches authenticated API responses or application HTML as plaintext.
- [x] Offline navigation fallback and cache-version update strategy.
- [x] PWA update notification/activation UI.
- [x] Mobile/coarse-pointer/safe-area/reduced-motion hardening.
- [x] Workspace capability navigation exposes Offline & PWA controls.

## Security/integrity
- Local document/task/attachment payloads are AES-GCM encrypted with a non-extractable browser CryptoKey.
- Server replay rechecks workspace authorization, device revocation and workspace offline policy.
- Mutation operation IDs are idempotent; reusing an ID with a different payload is rejected.
- Divergent document/task versions create durable conflict records instead of last-write-wins.
- Authenticated HTML/API responses are network-only in the service worker.

## Required test matrix
- [ ] Forced offline document/task editing.
- [ ] Long offline then divergent remote change.
- [ ] Storage quota exhaustion.
- [ ] Service-worker update/rollback.
- [ ] Offline-disabled workspace denial.
- [ ] Revoked device replay.
- [ ] Mobile memory/input pressure.

## Exit gate
- [x] Connectivity loss has an encrypted acknowledged local persistence path.
- [x] Users can see queued/synced/conflicted state and resolve conflicts.
- [x] Workspace policy controls attachment/offline use server-side.
- [ ] Automated browser/security/load evidence pending combined CI gate.

## Completion record
- Commit/PR: consolidated Phase 16–21 implementation commit.
- Migration: `0020_offline_pwa.sql`.
- Staging deployment: intentionally deferred to avoid preview-deployment churn.
- Test evidence: CI/typecheck/lint/build/browser/integration intentionally deferred by instruction.
- Performance evidence: queue batches capped at 100; attachment/device quota enforced; measured browser memory pending validation.
- Deferred items: automated validation evidence only.
- Approval/date: implementation completed 2026-10-09; validation pending.
