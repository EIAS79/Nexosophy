# Nexosophy core release gate — Phases 00–21

Verified: 2026-10-11 (Europe/Warsaw). Owner scope: core phases 00–21, including Phase 02B Nexosophy-owned authentication. Defer 22–24 (billing/final hardening/public launch). Critical security and data-isolation checks still block deploying the core to publicly accessible production.

## Current verdict: NOT SAFE TO MERGE

- Local `pnpm ci:full` exit 0. Fresh `pnpm exec turbo run typecheck test build --force` exit 0: 39/39 successful, 0 cached.
- API automated tests: 7 passed, 1 skipped. The skipped test is real PostgreSQL custom authentication integration; therefore registration, verification, session revocation and internal user mapping lack database-backed proof.
- Local plan checkboxes for 00–21: 304 marked / 195 open (historical claims only). Replacement Phase 02B adds 21 open acceptance checks and supersedes the old Clerk-era Phase 02 checklist.
- Local custom-auth implementation and these plans are unpublished in the working tree. PR #19 published head 490dc80 had green CI on old Clerk runtime, not new owned auth.
- Isolated Neon staging has 21 migration ledger entries through `0020_offline_pwa.sql`. New `0021_nexosophy_auth_core.sql` is not applied.
- Render staging API latest deploy `update_failed`; realtime and worker latest deploys `live`. Real two-user browser/API acceptance not yet proven.
- Current local source checkout: `C:\Users\khali\AppData\Local\Temp\nexosophy-20261010-clean`. It has local unpublished commits and changes. Never discard/overwrite them.
- Existing cinematic production homepage must be preserved. Vercel preview quotas must not be wasted.

## Required next gates in order

1. Review auth runtime/security, trusted origins/callbacks, session/cookie bridge, disabled/deleted-user checks and provider handling; use reviewed crypto libraries only. Verify OAuth and email delivery; no authentication bypass.
2. Apply/test the new migration on disposable PostgreSQL, verify idempotence, then use only Anas staging Neon. Execute the skipped owned-auth integration test and cross-user session tests.
3. Reconcile local changes and remote PR #19, publish ONE consolidated update preserving current `main`, and run GitHub Fast CI, Build and Backend Integration on the exact new commit.
4. Fix Render API startup on Anas staging; perform two-account login/logout, MFA/recovery/session revoke, tenant IDOR, document/upload/history/realtime, offline and phase-specific E2E.
5. Verify each phase checklist against its observed real-world behavior; address open items rather than marking them complete because build succeeds.
6. Merge to `main` only after exact-head CI + critical staging acceptance pass. Phase 22 billing, Phase 23 final launch hardening and Phase 24 broad public rollout remain separate projects.

## Source of truth

- `plan/02-identity-billing/00-auth-nexosophy-owned.md` — authentication architecture
- `plan/13-phases/phase-02b-owned-auth-replacement.md` — replacement implementation
- `plan/13-phases/phase-00...phase-21*.md` — individual phase acceptance
- `plan/RELEASE_EXECUTION_CHECKPOINT.md` — project handoff; note old Clerk-era statements are obsolete
- `plan/IMPLEMENTATION_SEQUENCE.md` — canonical phase ordering; Phase 02 updated to owned authentication
