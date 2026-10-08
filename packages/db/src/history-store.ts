import type { Pool, PoolClient } from "pg";

import type { RichDocumentBody } from "./document-store.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export type DocumentVersionRecord = {
  id: string;
  workspaceId: string;
  nodeId: string;
  sourceRevision: number;
  schemaVersion: number;
  reason: "checkpoint" | "manual" | "restore";
  label: string | null;
  createdByUserId: string;
  createdAt: Date;
};

type VersionRow = {
  id: string;
  workspace_id: string;
  node_id: string;
  source_revision: number;
  schema_version: number;
  reason: DocumentVersionRecord["reason"];
  label: string | null;
  created_by_user_id: string;
  created_at: Date;
  body?: RichDocumentBody;
};

function toVersion(row: VersionRow): DocumentVersionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    sourceRevision: row.source_revision,
    schemaVersion: row.schema_version,
    reason: row.reason,
    label: row.label,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

type Cursor = { createdAt: string; id: string };

function decodeCursor(cursor?: string): Cursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Cursor;
    return value.createdAt && value.id ? value : null;
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

export async function maybeCreateDocumentCheckpoint(
  client: PoolClient,
  input: {
    workspaceId: string;
    nodeId: string;
    sourceRevision: number;
    schemaVersion: number;
    body: RichDocumentBody;
    actorUserId: string;
  },
): Promise<void> {
  const latest = await client.query<{ source_revision: number; created_at: Date }>(
    `select "source_revision", "created_at"
     from "document_versions"
     where "workspace_id" = $1 and "node_id" = $2 and "reason" = 'checkpoint'
     order by "created_at" desc, "id" desc
     limit 1`,
    [input.workspaceId, input.nodeId],
  );
  const previous = latest.rows[0];
  const oldEnough =
    !previous || Date.now() - previous.created_at.getTime() >= 2 * 60 * 1000;
  const enoughRevisions =
    !previous || input.sourceRevision - previous.source_revision >= 20;
  if (!oldEnough && !enoughRevisions) return;

  await client.query(
    `insert into "document_versions"
       ("workspace_id", "node_id", "source_revision", "schema_version", "body",
        "reason", "created_by_user_id")
     values ($1, $2, $3, $4, $5::jsonb, 'checkpoint', $6)
     on conflict do nothing`,
    [
      input.workspaceId,
      input.nodeId,
      input.sourceRevision,
      input.schemaVersion,
      JSON.stringify(input.body),
      input.actorUserId,
    ],
  );
}

export async function createManualDocumentCheckpoint(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    label?: string | undefined;
    requestId?: string | undefined;
  },
): Promise<DocumentVersionRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const document = await client.query<{
      schema_version: number;
      body: RichDocumentBody;
      revision: number;
    }>(
      `select "schema_version", "body", "revision"
       from "documents"
       where "workspace_id" = $1 and "node_id" = $2
       for update`,
      [input.workspaceId, input.nodeId],
    );
    const row = document.rows[0];
    if (!row) throw new Error("DOCUMENT_NOT_FOUND");

    const created = await client.query<VersionRow>(
      `insert into "document_versions"
         ("workspace_id", "node_id", "source_revision", "schema_version", "body",
          "reason", "label", "created_by_user_id")
       values ($1, $2, $3, $4, $5::jsonb, 'manual', $6, $7)
       returning "id", "workspace_id", "node_id", "source_revision",
                 "schema_version", "reason", "label", "created_by_user_id", "created_at"`,
      [
        input.workspaceId,
        input.nodeId,
        row.revision,
        row.schema_version,
        JSON.stringify(row.body),
        input.label ?? null,
        input.actorUserId,
      ],
    );
    const version = created.rows[0];
    if (!version) throw new Error("Checkpoint creation failed.");
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "document.checkpoint_created",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: { versionId: version.id, revision: row.revision, label: input.label ?? null },
    });
    return toVersion(version);
  });
}

export async function listDocumentVersions(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    limit?: number | undefined;
    cursor?: string | undefined;
  },
): Promise<{ items: DocumentVersionRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const cursor = decodeCursor(input.cursor);
  const result = await pool.query<VersionRow>(
    `select "id", "workspace_id", "node_id", "source_revision", "schema_version",
            "reason", "label", "created_by_user_id", "created_at"
     from "document_versions"
     where "workspace_id" = $1 and "node_id" = $2
       and (
         $3::timestamptz is null
         or ("created_at", "id") < ($3::timestamptz, $4::uuid)
       )
     order by "created_at" desc, "id" desc
     limit $5`,
    [input.workspaceId, input.nodeId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  );
  const mapped = result.rows.map(toVersion);
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

export async function restoreDocumentVersion(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    versionId: string;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<{
  revision: number;
  body: RichDocumentBody;
  restoredFromVersionId: string;
}> {
  return withWorkspaceTransaction(pool, async (client) => {
    const version = await client.query<VersionRow & { body: RichDocumentBody }>(
      `select "id", "workspace_id", "node_id", "source_revision", "schema_version",
              "body", "reason", "label", "created_by_user_id", "created_at"
       from "document_versions"
       where "workspace_id" = $1 and "node_id" = $2 and "id" = $3
       limit 1`,
      [input.workspaceId, input.nodeId, input.versionId],
    );
    const historical = version.rows[0];
    if (!historical) throw new Error("DOCUMENT_VERSION_NOT_FOUND");

    const current = await client.query<{
      revision: number;
      schema_version: number;
      body: RichDocumentBody;
    }>(
      `select "revision", "schema_version", "body"
       from "documents"
       where "workspace_id" = $1 and "node_id" = $2
       for update`,
      [input.workspaceId, input.nodeId],
    );
    const existing = current.rows[0];
    if (!existing) throw new Error("DOCUMENT_NOT_FOUND");

    await client.query(
      `insert into "document_versions"
         ("workspace_id", "node_id", "source_revision", "schema_version", "body",
          "reason", "label", "created_by_user_id")
       values ($1, $2, $3, $4, $5::jsonb, 'manual', 'Before restore', $6)`,
      [
        input.workspaceId,
        input.nodeId,
        existing.revision,
        existing.schema_version,
        JSON.stringify(existing.body),
        input.actorUserId,
      ],
    );

    const updated = await client.query<{ revision: number; body: RichDocumentBody }>(
      `update "documents"
       set "body" = $3::jsonb,
           "schema_version" = $4,
           "revision" = "revision" + 1,
           "updated_by_user_id" = $5,
           "updated_at" = now()
       where "workspace_id" = $1 and "node_id" = $2
       returning "revision", "body"`,
      [
        input.workspaceId,
        input.nodeId,
        JSON.stringify(historical.body),
        historical.schema_version,
        input.actorUserId,
      ],
    );
    const restored = updated.rows[0];
    if (!restored) throw new Error("Document restore failed.");

    await client.query(
      `insert into "document_versions"
         ("workspace_id", "node_id", "source_revision", "schema_version", "body",
          "reason", "label", "created_by_user_id")
       values ($1, $2, $3, $4, $5::jsonb, 'restore', $6, $7)`,
      [
        input.workspaceId,
        input.nodeId,
        restored.revision,
        historical.schema_version,
        JSON.stringify(historical.body),
        "Restored version " + historical.id,
        input.actorUserId,
      ],
    );
    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'document', $2, 'document.version_restored', $3::jsonb)`,
      [
        input.workspaceId,
        input.nodeId,
        JSON.stringify({
          nodeId: input.nodeId,
          revision: restored.revision,
          versionId: input.versionId,
          actorUserId: input.actorUserId,
        }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "document.version_restored",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: {
        versionId: input.versionId,
        revision: restored.revision,
        sourceRevision: historical.source_revision,
      },
    });
    return {
      revision: restored.revision,
      body: restored.body,
      restoredFromVersionId: input.versionId,
    };
  });
}

export type TrashEntryRecord = {
  nodeId: string;
  name: string;
  kind: string;
  trashedAt: Date;
  purgeAt: Date;
  daysRemaining: number;
  parentId: string | null;
};

export async function listWorkspaceTrash(
  pool: Pool,
  input: {
    workspaceId: string;
    limit?: number | undefined;
    cursor?: string | undefined;
  },
): Promise<{ items: TrashEntryRecord[]; nextCursor: string | null; retentionDays: number }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const cursor = decodeCursor(input.cursor);
  const policy = await pool.query<{ trash_retention_days: number }>(
    `select "trash_retention_days"
     from "workspace_retention_policies"
     where "workspace_id" = $1`,
    [input.workspaceId],
  );
  const retentionDays = policy.rows[0]?.trash_retention_days ?? 30;
  const result = await pool.query<{
    id: string;
    name: string;
    kind: string;
    trashed_at: Date;
    parent_id: string | null;
    purge_at: Date;
  }>(
    `select n."id", n."name", n."kind"::text as "kind", n."trashed_at", n."parent_id",
            n."trashed_at" + make_interval(days => $2) as "purge_at"
     from "content_nodes" n
     left join "content_nodes" parent
       on parent."workspace_id" = n."workspace_id" and parent."id" = n."parent_id"
     where n."workspace_id" = $1 and n."trashed_at" is not null
       and (parent."id" is null or parent."trashed_at" is null)
       and (
         $3::timestamptz is null
         or (n."trashed_at", n."id") < ($3::timestamptz, $4::uuid)
       )
     order by n."trashed_at" desc, n."id" desc
     limit $5`,
    [input.workspaceId, retentionDays, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  );
  const rows = result.rows;
  const hasMore = rows.length > limit;
  const selected = hasMore ? rows.slice(0, limit) : rows;
  const items = selected.map((row) => ({
    nodeId: row.id,
    name: row.name,
    kind: row.kind,
    trashedAt: row.trashed_at,
    purgeAt: row.purge_at,
    daysRemaining: Math.max(
      0,
      Math.ceil((row.purge_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    ),
    parentId: row.parent_id,
  }));
  const last = selected.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.trashed_at, last.id) : null,
    retentionDays,
  };
}

export async function enqueuePermanentDeletion(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId?: string | undefined;
    reason: "user_request" | "retention";
    requestId?: string | undefined;
  },
): Promise<{ jobId: string; totalNodes: number }> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      "permanent-delete:" + input.workspaceId + ":" + input.nodeId,
    ]);
    const count = await client.query<{ count: string }>(
      `with recursive subtree as (
         select "id" from "content_nodes"
         where "workspace_id" = $1 and "id" = $2 and "trashed_at" is not null
         union all
         select child."id"
         from "content_nodes" child
         join subtree parent on child."parent_id" = parent."id"
         where child."workspace_id" = $1 and child."trashed_at" is not null
       )
       select count(*)::text as "count" from subtree`,
      [input.workspaceId, input.nodeId],
    );
    const totalNodes = Number(count.rows[0]?.count ?? 0);
    if (totalNodes === 0) throw new Error("TRASH_ENTRY_NOT_FOUND");

    const existing = await client.query<{ id: string; total_nodes: number }>(
      `select "id", "total_nodes"
       from "content_deletion_jobs"
       where "workspace_id" = $1 and "root_node_id" = $2
         and "status" in ('queued','running')
       limit 1`,
      [input.workspaceId, input.nodeId],
    );
    if (existing.rows[0]) {
      return {
        jobId: existing.rows[0].id,
        totalNodes: existing.rows[0].total_nodes,
      };
    }

    const created = await client.query<{ id: string }>(
      `insert into "content_deletion_jobs"
         ("workspace_id", "root_node_id", "reason", "requested_by_user_id", "total_nodes")
       values ($1, $2, $3, $4, $5)
       returning "id"`,
      [
        input.workspaceId,
        input.nodeId,
        input.reason,
        input.actorUserId ?? null,
        totalNodes,
      ],
    );
    const jobId = created.rows[0]?.id;
    if (!jobId) throw new Error("Permanent deletion job creation failed.");
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "content.permanent_deletion_queued",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: { jobId, totalNodes, reason: input.reason },
    });
    return { jobId, totalNodes };
  });
}

export type DeletionJob = {
  id: string;
  workspaceId: string;
  rootNodeId: string;
  processedNodes: number;
  totalNodes: number;
  attempts: number;
  maxAttempts: number;
  reason: string;
  requestedByUserId: string | null;
};

export async function claimDeletionJob(
  pool: Pool,
  workerId: string,
): Promise<DeletionJob | null> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "content_deletion_jobs"
       set "status" = 'queued', "locked_at" = null, "locked_by" = null, "updated_at" = now()
       where "status" = 'running'
         and "locked_at" < now() - interval '10 minutes'
         and "attempts" < "max_attempts"`,
    );
    const selected = await client.query<{ id: string }>(
      `select "id"
       from "content_deletion_jobs"
       where "status" = 'queued' and "run_after" <= now()
         and "attempts" < "max_attempts"
       order by "run_after", "created_at", "id"
       for update skip locked
       limit 1`,
    );
    const id = selected.rows[0]?.id;
    if (!id) return null;
    const updated = await client.query<{
      id: string;
      workspace_id: string;
      root_node_id: string;
      processed_nodes: number;
      total_nodes: number;
      attempts: number;
      max_attempts: number;
      reason: string;
      requested_by_user_id: string | null;
    }>(
      `update "content_deletion_jobs"
       set "status" = 'running', "attempts" = "attempts" + 1,
           "locked_at" = now(), "locked_by" = $2, "updated_at" = now()
       where "id" = $1
       returning "id", "workspace_id", "root_node_id", "processed_nodes",
                 "total_nodes", "attempts", "max_attempts", "reason",
                 "requested_by_user_id"`,
      [id, workerId],
    );
    const row = updated.rows[0];
    return row
      ? {
          id: row.id,
          workspaceId: row.workspace_id,
          rootNodeId: row.root_node_id,
          processedNodes: row.processed_nodes,
          totalNodes: row.total_nodes,
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
          reason: row.reason,
          requestedByUserId: row.requested_by_user_id,
        }
      : null;
  });
}

export async function processDeletionBatch(
  pool: Pool,
  job: DeletionJob,
  batchSize = 200,
): Promise<"running" | "succeeded"> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      "content-tree:" + job.workspaceId,
    ]);

    const batch = await client.query<{ id: string }>(
      `with recursive subtree as (
         select "id", "parent_id", 0 as "depth"
         from "content_nodes"
         where "workspace_id" = $1 and "id" = $2 and "trashed_at" is not null
         union all
         select child."id", child."parent_id", parent."depth" + 1
         from "content_nodes" child
         join subtree parent on child."parent_id" = parent."id"
         where child."workspace_id" = $1 and child."trashed_at" is not null
       )
       select "id"
       from subtree
       order by "depth" desc, "id"
       limit $3`,
      [job.workspaceId, job.rootNodeId, batchSize],
    );

    if (batch.rows.length === 0) {
      await client.query(
        `update "content_deletion_jobs"
         set "status" = 'succeeded', "locked_at" = null, "locked_by" = null,
             "updated_at" = now()
         where "id" = $1`,
        [job.id],
      );
      return "succeeded";
    }

    const ids = batch.rows.map((row) => row.id);
    const assets = await client.query<{ id: string }>(
      `update "assets"
       set "trust_state" = 'deleted', "deleted_at" = coalesce("deleted_at", now()),
           "updated_at" = now()
       where "workspace_id" = $1 and "node_id" = any($2::uuid[])
         and "trust_state" <> 'deleted'
       returning "id"`,
      [job.workspaceId, ids],
    );
    for (const asset of assets.rows) {
      await client.query(
        `insert into "asset_processing_jobs" ("workspace_id", "asset_id", "job_type")
         values ($1, $2, 'cleanup')
         on conflict ("asset_id", "job_type")
         do update set "status" = 'queued', "run_after" = now(), "updated_at" = now()`,
        [job.workspaceId, asset.id],
      );
    }

    const removed = await client.query(
      `delete from "content_nodes"
       where "workspace_id" = $1 and "id" = any($2::uuid[])`,
      [job.workspaceId, ids],
    );
    const processed = removed.rowCount ?? 0;
    await client.query(
      `update "content_deletion_jobs"
       set "processed_nodes" = "processed_nodes" + $2,
           "locked_at" = now(), "updated_at" = now()
       where "id" = $1`,
      [job.id, processed],
    );
    return "running";
  });
}

export async function completeDeletionJob(
  pool: Pool,
  job: DeletionJob,
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "content_deletion_jobs"
       set "status" = 'succeeded',
           "processed_nodes" = greatest("processed_nodes", "total_nodes"),
           "locked_at" = null, "locked_by" = null, "updated_at" = now()
       where "id" = $1`,
      [job.id],
    );
    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'content', $2, 'content.permanently_deleted', $3::jsonb)`,
      [
        job.workspaceId,
        job.rootNodeId,
        JSON.stringify({
          nodeId: job.rootNodeId,
          reason: job.reason,
          processedNodes: job.totalNodes,
        }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: job.workspaceId,
      actorUserId: job.requestedByUserId ?? undefined,
      action: "content.permanently_deleted",
      targetType: "node",
      targetId: job.rootNodeId,
      metadata: {
        deletionJobId: job.id,
        reason: job.reason,
        processedNodes: job.totalNodes,
      },
    });
  });
}

export async function failDeletionJob(
  pool: Pool,
  job: DeletionJob,
  error: Error,
): Promise<void> {
  const retry = job.attempts < job.maxAttempts;
  await pool.query(
    `update "content_deletion_jobs"
     set "status" = $2::deletion_job_status,
         "run_after" = case
           when $2 = 'queued' then now() + make_interval(secs => least(900, 5 * power(2, "attempts")::int))
           else "run_after"
         end,
         "last_error" = left($3, 1000),
         "locked_at" = null, "locked_by" = null, "updated_at" = now()
     where "id" = $1`,
    [job.id, retry ? "queued" : "failed", error.message],
  );
}

export async function enqueueExpiredTrash(
  pool: Pool,
  limit = 100,
): Promise<number> {
  const candidates = await pool.query<{
    workspace_id: string;
    node_id: string;
  }>(
    `select n."workspace_id", n."id" as "node_id"
     from "content_nodes" n
     left join "content_nodes" parent
       on parent."workspace_id" = n."workspace_id" and parent."id" = n."parent_id"
     left join "workspace_retention_policies" policy
       on policy."workspace_id" = n."workspace_id"
     where n."trashed_at" is not null
       and (parent."id" is null or parent."trashed_at" is null)
       and n."trashed_at" + make_interval(days => coalesce(policy."trash_retention_days", 30)) <= now()
       and not exists (
         select 1 from "content_deletion_jobs" j
         where j."workspace_id" = n."workspace_id"
           and j."root_node_id" = n."id"
           and j."status" in ('queued','running')
       )
     order by n."trashed_at"
     limit $1`,
    [limit],
  );
  for (const candidate of candidates.rows) {
    await enqueuePermanentDeletion(pool, {
      workspaceId: candidate.workspace_id,
      nodeId: candidate.node_id,
      reason: "retention",
    });
  }
  return candidates.rows.length;
}

export type AuditEventRecord = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export async function listWorkspaceAuditEvents(
  pool: Pool,
  input: {
    workspaceId: string;
    limit?: number | undefined;
    cursor?: string | undefined;
    action?: string | undefined;
  },
): Promise<{ items: AuditEventRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const cursor = decodeCursor(input.cursor);
  const result = await pool.query<{
    id: string;
    actor_user_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    request_id: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(
    `select "id", "actor_user_id", "action", "target_type", "target_id",
            "request_id", "metadata", "created_at"
     from "workspace_audit_events"
     where "workspace_id" = $1
       and ($2::text is null or "action" = $2)
       and (
         $3::timestamptz is null
         or ("created_at", "id") < ($3::timestamptz, $4::uuid)
       )
     order by "created_at" desc, "id" desc
     limit $5`,
    [
      input.workspaceId,
      input.action ?? null,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      limit + 1,
    ],
  );
  const rows = result.rows;
  const hasMore = rows.length > limit;
  const selected = hasMore ? rows.slice(0, limit) : rows;
  const items = selected.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    requestId: row.request_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
  const last = selected.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
  };
}
