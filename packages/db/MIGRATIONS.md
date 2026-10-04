# Nexosophy Database Migration Policy

## Production rule

Nexosophy uses **forward-safe migrations**. Production rollback means rolling application code back only when the database remains backward compatible; destructive schema reversal is not the default recovery mechanism.

## Expand → migrate → contract

For destructive or compatibility-sensitive changes:

1. **Expand** — add new nullable columns/tables/indexes/structures without removing the old contract.
2. **Migrate** — deploy compatible application code and backfill data in bounded, restartable batches.
3. **Verify** — measure correctness and usage of the new representation.
4. **Contract** — remove obsolete structures in a later deployment after the compatibility window.

Never combine an incompatible destructive database change with the application change that first depends on it.

## Migration properties

Every production migration must be:

- ordered and immutable after release;
- recorded in `_nexosophy_migrations`;
- protected by the migration advisory lock;
- safe to retry;
- reviewed for lock duration and table rewrite risk;
- observable in deployment logs;
- compatible with rolling application instances or explicitly gated by maintenance/read-only mode.

## Backfills

Large backfills are application jobs, not one enormous migration transaction.

Backfills must support:

- bounded batches;
- checkpointing;
- idempotency;
- pause/resume;
- rate limiting;
- progress metrics;
- failure recovery.

## Indexes

On large live tables, use PostgreSQL online/concurrent strategies where required by the specific migration and managed-provider constraints.

## Recovery

If a migration introduces a defect:

1. stop further promotion;
2. disable the affected feature when possible;
3. roll application code back only if schema compatibility permits;
4. ship a **forward corrective migration**;
5. restore from backup/PITR only for actual data-loss/corruption scenarios.

## Verification

CI runs the migration set against a clean PostgreSQL service and immediately runs it a second time to prove the baseline is idempotent.

Backup/PITR restoration is certified later in the production-hardening phase.
