# Nexosophy — Execution Checkpoint and Release Roadmap

> **Last verified:** 2026-10-11 (Europe/Warsaw)  
> **Status:** IN PROGRESS — remote CI green; Anas Render staging API/realtime/worker created; worker packaging fixed locally and queued for remote verification; Clerk staging authentication/acceptance pending.  
> **Canonical plan:** `plan/IMPLEMENTATION_SEQUENCE.md` and `plan/13-phases/phase-00…phase-24*.md`.  
> **Rule:** Checkboxes mean claimed completion in the plan, not independent certification. Never mark a phase fully accepted without evidence.

## 0. Purpose — the restart instructions

This file is the persistent handoff for the next ChatGPT coding session. **Read this first**, then confirm GitHub and cloud state live before making changes. Work continuously through the blockers rather than asking after every sub-phase. The user wants a production-grade Nexosophy application, not merely a compiling codebase. Keep commits and Vercel preview deployments to a minimum: batch local work, run checks once per coherent batch, and publish only meaningful release checkpoints. Avoid touching Edulytics and GoSpots.

## 1. Repositories, local work and exact stop point

- Repository: `EIAS79/Nexosophy`; public site `https://nexosophy.vercel.app`.
- Release branch/PR: `phases-05-07-storage-editor-history`, PR **#19** (`https://github.com/EIAS79/Nexosophy/pull/19`). On 2026-10-11 the **remote head** was `9b99480617081eeb09842ac7c219ce4ceaead0df`, **draft**, **mergeable=false**, **not merged**. Re-fetch before publishing. The branch is behind newer `main`, which contains the cinematic homepage; DO NOT overwrite it.
- Authorized desktop clone: `C:\Users\khali\AppData\Local\Temp\nexosophy-20261010-clean`, Windows device `Our-CS`. Locally reconciled `main` in merge commit `a0533b8`, then fixed Windows/unix migration CLI in `8251765`; both were **local only** at last verification. Local untracked `tsconfig.tsbuildinfo` must NEVER be committed.
- Direct git push from this Windows clone failed because noninteractive GitHub credentials are missing. Connected **GitHub** tools can create trees, commits and update refs. Avoid rewriting published history or generating many commits/previews.
- **On resume: priority one is reconcile/publish ONE combined tested PR update preserving current `main` homepage; trigger/confirm remote CI; do not merge while tests are absent or failing.**
- Current task at checkpoint creation: create this document; staging Neon branch has been provisioned. Documentation alone does not close release/phase gates.

## 2. Verified engineering evidence

| Gate | Verified finding | Qualification |
|---|---|---|
| Local formatting | Pass | After local canonical formatting and excluding generated `.turbo` |
| Local lint + TypeScript | Pass | Repository-wide relevant tasks |
| `pnpm ci:full` | Exit 0, final production build **13/13 tasks** | From local reconciled source, including migration CLI patch; NOT a remote GitHub pass |
| Earlier `ci:fast` | 20/20 local tasks | Individual feature acceptance not inferred |
| Real PostgreSQL 17 SQL migrations | 21/21 applied and idempotent | Tested on isolated local PostgreSQL, and subsequently applied to Anas-owned Neon |
| Real DB identity/workspace/content tests | All three integration programs passed locally | These are not comprehensive browser/production security tests |
| API `/health`, `/ready` | HTTP 200 with PG and Redis healthy in isolated local environment | Not live Render |
| GitHub Actions on new corrected release | Not confirmed passing | Earlier CI/Build/Backend Integration failures were for older SHAs |
| PR merge to `main` | NOT DONE | Intentionally preserve working homepage |
| Production-like browser E2E, security, capacity | Not certified | Must run stage acceptance matrix |

## 3. Infrastructure — always use ANAS accounts, not Khalid

**Neon Anas** link `link_6acb064100288191b66def7d8b84ae3b`; **Render Anas** link `link_6acb068ee3088191ac852a7b91883451`. Pass explicit `link_id` to every provider tool; never guess default.

| Item | Exact verified ID/state | Next work |
|---|---|---|
| Neon project | `Nexosophy`, `little-frost-55011435`, Frankfurt, PostgreSQL 17, Free | Restrict credentials, backups, monitor quota |
| Neon main branch | `br-aged-queen-bamwgcge` | **Production-intended**; 21 migration ledger records and 209 public tables installed. Avoid staging tests on it |
| Neon staging branch | `nexosophy-staging`, `br-wandering-frog-ba0xb6si` | Created 2026-10-11 from main; read-only query confirmed **21 migrations** inherited. Use for integration tests |
| Neon private object bucket | `nexosophy-assets` on main branch, private | Validate S3 adapter/credentials and that staging storage is isolated; enforce scanning/quarantine |
| Render workspace | `venue flow`, `tea-d86vi4ek1jcs739nm350` | Use only this account |
| Render Key Value | `nexosophy-redis`, `red-db5gentckfvc73a4hbm0`, Frankfurt, **Free/available** | Configure connection securely; Free is not durable production cache |
| Render staging API/realtime/worker | API `srv-db5hd1l9fdbs73ct2v50`, realtime `srv-db5hdcl9fdbs73ct427g`, worker `srv-db5hddlckfvc73a7npkg`. All Anas, Frankfurt, Free and autoDeploy=no | Each connects to Neon staging and internal Redis; API still needs Clerk Development configuration. Worker free tier is not reliable always-on hosting. |
| Clerk application | `Nexosophy` (renamed from My Application), app `app_3KX73PP1OGDDwRdMPyIEvVsdpuS` | **Development** instance only. Production instance + owned custom domain intentionally deferred until launch |
| Clerk Development instance | `ins_3KX73MssFzzwP7TKi7KTCfG6A2s` | Use for stage E2E and test users. Never use Dev credentials for public production |
| Vercel | Existing site `nexosophy.vercel.app` | Current project previously had no environment variables; verify live. Preserve homepage; do not trigger previews needlessly |
| Custom domain | **Not owned** | User explicitly deferred domain registration until near-final launch; do not block staging on it |

The separate Khalid Render workspace contains Edulytics/Apexify; Khalid Neon contains Edulytiks. **Never repurpose, alter, or delete those.** Temporary local PostgreSQL/Redis Nexosophy Docker containers created for integration were cleaned up. No Nexosophy cloud resource was created in Khalid's accounts.

**Secrets:** Never copy provider credentials to chat, repository, logs, or arbitrary remote shells. Configure sensitive env vars through provider dashboards/authorized secrets workflows only. No production auth bypass. Stage may use Clerk Development with `APP_ENV=staging` and valid Clerk config, but production must use real production instance/domains.

## 4. Canonical phase matrix — checked / total, not measured percent done

| Phase | Subject | Plan checked | Evidence / highest-priority open gate |
|---|---|---:|---|
| 00 | Repo baseline/CI | 25/26 | Enforce branch protection/ruleset and remote required CI |
| 01 | Design system/shell | 0/23 | Responsive/accessibility/keyboard/manual acceptance; code exists |
| 02 | Auth/accounts | 19/26 | Clerk dev E2E, OAuth, session revoke, cross-user IDOR |
| 03 | Workspaces/RBAC | 0/24 | Tenant separation, grants, invite, permission revoke; code exists |
| 04 | Recursive files/tree | 24/24 | Checklist closed; staging operation tests still recommended |
| 05 | Uploads/media/previews | 13/26 | Real S3 upload/multipart, malware scan, worker and recovery |
| 06 | API/scale/editor | 14/31 | Redis/queue staging, idempotence/concurrency/load, editor E2E |
| 07 | History/trash/audit | 0/16 | Restore-as-new-version, permanent delete propagation, audit |
| 08 | Realtime collaboration | 0/19 | Deploy websocket, CRDT convergence, room auth/revocation |
| 09 | Notes/whiteboard | 14/22 | Touch/stylus, offline, two-user ink conflict and performance |
| 10 | Search/relations | 13/19 | Revoked access cannot leak search, reindex/capacity |
| 11 | Productivity | 16/26 | DST, duplicate reminders, calendar series edits, outage catch-up |
| 12 | Import/export/templates | 18/24 | Malformed/hostile files, resumable workers, export redaction |
| 13 | Structured tables/code | 17/24 | Formula cycles/scale, execution isolation, keyboard/limits |
| 14 | Student/course | 17/24 | Semester and timezone behavior, permissions, mobile |
| 15 | Thesis/references | 23/30 | BibTeX/RIS, duplicates, citation fixtures, supervisor access |
| 16 | Research/lab | 23/31 | Inventory races, sample/protocol lineage, equipment collisions |
| 17 | Teaching/supervision | 10/15 | Unreleased grades/feedback, revoke, roster load |
| 18 | Reporting/investigations | 12/13 | Security/redaction/race validation |
| 19 | Analysis/visualization | 12/13 | Load/authorization/reproducibility tests |
| 20 | Office integrations | 14/15 | Real OAuth/provider/security token/revocation/outages |
| 21 | Offline/PWA | 20/28 | Offline edit conflicts, SW rollback, revoked device, quotas |
| 22 | Billing | 0/26 | Stripe Checkout/Portal, signed webhooks, entitlements, ledger; basically unbuilt |
| 23 | Hardening/certification | 0/24 | Threat model, SAST, pen test, restore, load/SLO, accessibility |
| 24 | Staged launch | 0/19 | Internal/technical alpha → beta → controlled GA/rollback |

**Totals from 2026-10-11 local audit:** 304 checked, 264 unchecked across 25 phases; Phases 05–21 have 140 unchecked. The repository contained ~306 first-party TS/JS source files but only ~14 first-party test/integration files at the time, highlighting material testing debt. Do not interpret plan checkmarks as independently passing features. Phase 01, 03, 07, 08 checklists are unmarked despite code for some surfaces. Phase 04 being 24/24 is not full production acceptance.

## 5. Ordered work queue (the action map)

### P1 — Release engineering; current focus
1. Refresh latest GitHub main/PR and local branch. Keep cinematic homepage, merge `main` into PR branch and resolve lockfile carefully. Local merge `a0533b8` already did this and local `8251765` fixes `packages/db/src/migrate.ts` Windows CLI. Do not publish incompatible trees.
2. Add this checkpoint to the release branch in the **same consolidated release update**, with useful CI/migration fixes. Avoid Vercel preview spam. Do not commit `tsconfig.tsbuildinfo`.
3. Run `pnpm ci:full`, migration tests, relevant smoke checks on exactly the publishable tree. Verify GitHub Actions Fast CI, Build, Backend Integration and required checks. Fix failures, make PR mergeable; enforce `main` branch rulesets if provider tooling allows.
4. **No premature merge**: green remote checks and staged critical flows required.

### P2 — Isolated staging stack
1. Use staging Neon `br-wandering-frog-ba0xb6si`, not main; check schema and storage branch isolation.
2. Configure Render API/realtime/worker services under Anas. Service Dockerfiles in `infra/docker/Dockerfile.api`, `Dockerfile.realtime`, `Dockerfile.worker`; link to the tested release branch with `autoDeploy=no` to avoid repeated deploys. Do not start insecure production-labelled backend with missing Clerk secrets.
3. Securely set DATABASE_URL, REDIS_URL, Clerk dev config, realtime token/URL, storage bucket/credentials, Web origin. Validate connectivity and actual service startup. Check plans: never incur paid always-on service charges without approval.
4. Stage Vercel environment separately from production, preferably one stable staging release, no per-commit previews.

### P3 — Acceptance test tranches
1. **First tranche Phase 01–08:** two Clerk test users, login/logout, personal/team workspace, invite/sharing, tenant IDOR probes, folder and document create/edit, upload/scan, history restore, real-time concurrent edits and revocation. Browser + API E2E and database assertions.
2. Second tranche Phase 09–13: notes/whiteboard, search, task/calendar/reminder, import/export, spreadsheet and sandbox tests.
3. Third tranche Phase 14–21: student/references, research/inventory, teaching, reporting/analytics, providers, offline and conflict/recovery.
4. For every phase: save test evidence, mark only proven gates in its Markdown, document missing features and fix code. Define a minimum production acceptance matrix across browsers and mobile.

### P4 — Billing
1. **After core gates:** Phase 22 Stripe test mode, signed webhooks/ledger, entitlements, Portal, billing UI, races, reconciliation. Requires merchant ownership/legal/payout details. Do not take real payments until certified.

### P5 — Production hardening and launch
1. Phase 23: tenant penetration regression, dependency/secret/container scans, capacity/spike/soak, backup/PITR drill, object-store restore, observability/alerts, legal/privacy/accessibility review, rollout/rollback rehearse.
2. Buy/verify custom domain near release; create Clerk **Production** instance, configure DNS and production secrets. User deferred domain intentionally.
3. Phase 24: internal alpha, invite-only alpha, university/research beta, public beta, GA with rollout/rollback metrics. Merge/release only after explicit gates, verify live domain and end-to-end smoke.

## 6. Completion definition and reporting cadence

- **Implemented** = checked-in code and persistence, not enough by itself.
- **Locally verified** = passing automated test/build against the exact commit.
- **Staging accepted** = real PG/Redis/Clerk/S3/worker/realtime/browser E2E evidence; security/rollback flows verified.
- **Production certified** = staged release, production secrets/domains, hardened infrastructure, security/load/recovery signoffs, controlled rollout and smoke test.
- Report each phase as `coded / locally tested / staging tested / accepted`, not arbitrary completion percentages.
- Work through backlog sequentially and batch publication. Never claim “fully working in production” on the basis of a build or schema only.

## 7. Resume command for next session

> Read `plan/RELEASE_EXECUTION_CHECKPOINT.md`, inspect PR #19 and current `main`, then continue **P1 release reconciliation and remote checks**, followed by P2 staging setup. Use Anas cloud accounts exclusively. Keep main/homepage safe. Consolidate commits, prove all claims with tests, and update this checkpoint after each durable milestone.


## 8. 2026-10-11 staging deployment checkpoint

- PR #19 reconciled commit `df82f255` passed remote CI Fast, Build and Backend Integration, and was mergeable but remains draft. New worker-fix commit below must pass these checks again.
- Staging Render services under **Anas**: API `srv-db5hd1l9fdbs73ct2v50`, realtime `srv-db5hdcl9fdbs73ct427g`, worker `srv-db5hddlckfvc73a7npkg`; Docker from PR branch `phases-05-07-storage-editor-history`, Frankfurt Free, `autoDeploy=no` to prevent repeated previews. Neon project `little-frost-55011435`, staging branch `br-wandering-frog-ba0xb6si` and private storage bucket `nexosophy-assets`; NO production-main DB was used.
- Render private `nexosophy-redis` internal URL configured under its default no-internal-auth mode; shared randomly generated realtime signing secret configured for API/realtime; websocket URL `wss://nexosophy-realtime-staging.onrender.com`.
- Actual Render build/start uncovered missing **BullMQ optional `ioredis` runtime dependency** in worker package. Fixed with pinned `ioredis@5.8.2` in `apps/worker/package.json`, matching lockfile, and portable `scripts/verify-worker-runtime.mjs` appended to `ci:build`. `pnpm ci:full` passed locally, including a prod pnpm deploy resolving both BullMQ and ioredis. Confirm remote CI on new commit then manually deploy worker once (autoDeploy=no).
- API has a deliberate fail-closed production/staging auth gate; Render logs show **Clerk configuration required**, not a source build bug. Need five Clerk Development values: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `CLERK_AUTHORIZED_PARTIES` for the actual staging frontend URL. Create signed webhook at `https://nexosophy-api-staging.onrender.com/api/webhooks/clerk`, then supply secrets through official provider dashboard. Do NOT bypass auth and do not paste secrets into chat or GitHub. Vercel Preview needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and `NEXOSOPHY_API_URL` scoped to Preview only.
- Worker and realtime still require live health/realtime checks; no two-user E2E complete. Render Free sleeping prevents production-grade always-on worker. Do not create paid resources without explicit plan approval. Domain and Clerk Production remain deferred at user's request.
- **Next:** verify new remote CI, restart worker only after fix, inspect runtime logs; securely configure Clerk Dev and Vercel Preview, verify API `health`/`ready`, run two-user auth/RBAC/content/upload/history/collaboration staging acceptance; then phases 09–21.
