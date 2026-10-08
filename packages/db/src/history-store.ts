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
  body?: unknown;
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

type SpatialHistoryBody = {
  type: "spatial";
  document: {
    pageMode: string;
    backgroundKind: string;
    paperSize: string;
    orientation: string;
    settings: Record<string, unknown>;
  };
  elements: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    zRank: number;
    groupId: string | null;
    locked: boolean;
    payload: Record<string, unknown>;
  }>;
};

async function snapshotSpatialDocument(
  client: PoolClient,
  workspaceId: string,
  nodeId: string,
): Promise<{ version: number; body: SpatialHistoryBody } | null> {
  const document = await client.query<{
    page_mode: string;
    background_kind: string;
    paper_size: string;
    orientation: string;
    settings: Record<string, unknown>;
    version: number;
  }>(
    `select "page_mode", "background_kind", "paper_size", "orientation", "settings", "version"
     from "spatial_documents"
     where "workspace_id" = $1 and "node_id" = $2
     for update`,
    [workspaceId, nodeId],
  );
  const row = document.rows[0];
  if (!row) return null;

  const elements = await client.query<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    z_rank: string | number;
    group_id: string | null;
    locked: boolean;
    payload: Record<string, unknown>;
  }>(
    `select "id", "type"::text as "type", "x", "y", "width", "height",
            "rotation", "z_rank", "group_id", "locked", "payload"
     from "spatial_elements"
     where "workspace_id" = $1 and "node_id" = $2
     order by "z_rank", "id"`,
    [workspaceId, nodeId],
  );

  return {
    version: row.version,
    body: {
      type: "spatial",
      document: {
        pageMode: row.page_mode,
        backgroundKind: row.background_kind,
        paperSize: row.paper_size,
        orientation: row.orientation,
        settings: row.settings ?? {},
      },
      elements: elements.rows.map((element) => ({
        id: element.id,
        type: element.type,
        x: Number(element.x),
        y: Number(element.y),
        width: Number(element.width),
        height: Number(element.height),
        rotation: Number(element.rotation),
        zRank: Number(element.z_rank),
        groupId: element.group_id,
        locked: element.locked,
        payload: element.payload ?? {},
      })),
    },
  };
}

export async function maybeCreateSpatialCheckpoint(
  client: PoolClient,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
  },
): Promise<void> {
  const spatial = await snapshotSpatialDocument(client, input.workspaceId, input.nodeId);
  if (!spatial) return;

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
    !previous || spatial.version - previous.source_revision >= 20;
  if (!oldEnough && !enoughRevisions) return;

  await client.query(
    `insert into "document_versions"
       ("workspace_id", "node_id", "source_revision", "schema_version", "body",
        "reason", "created_by_user_id")
     values ($1, $2, $3, 1, $4::jsonb, 'checkpoint', $5)
     on conflict do nothing`,
    [
      input.workspaceId,
      input.nodeId,
      spatial.version,
      JSON.stringify(spatial.body),
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
    let sourceRevision: number;
    let schemaVersion: number;
    let body: unknown;

    if (row) {
      sourceRevision = row.revision;
      schemaVersion = row.schema_version;
      body = row.body;
    } else {
      const spatial = await snapshotSpatialDocument(client, input.workspaceId, input.nodeId);
      if (!spatial) throw new Error("DOCUMENT_NOT_FOUND");
      sourceRevision = spatial.version;
      schemaVersion = 1;
      body = spatial.body;
    }

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
        sourceRevision,
        schemaVersion,
        JSON.stringify(body),
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
      metadata: { versionId: version.id, revision: sourceRevision, label: input.label ?? null },
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
  body: unknown;
  restoredFromVersionId: string;
}> {
  return withWorkspaceTransaction(pool, async (client) => {
    const version = await client.query<VersionRow & { body: unknown }>(
      `select "id", "workspace_id", "node_id", "source_revision", "schema_version",
              "body", "reason", "label", "created_by_user_id", "created_at"
       from "document_versions"
       where "workspace_id" = $1 and "node_id" = $2 and "id" = $3
       limit 1`,
      [input.workspaceId, input.nodeId, input.versionId],
    );
    const historical = version.rows[0];
    if (!historical) throw new Error("DOCUMENT_VERSION_NOT_FOUND");

    const spatialBody =
      historical.body &&
      typeof historical.body === "object" &&
      (historical.body as { type?: unknown }).type === "spatial"
        ? (historical.body as SpatialHistoryBody)
        : null;

    if (spatialBody) {
      const current = await snapshotSpatialDocument(client, input.workspaceId, input.nodeId);
      if (!current) throw new Error("DOCUMENT_NOT_FOUND");

      await client.query(
        `insert into "document_versions"
           ("workspace_id", "node_id", "source_revision", "schema_version", "body",
            "reason", "label", "created_by_user_id")
         values ($1, $2, $3, 1, $4::jsonb, 'manual', 'Before restore', $5)`,
        [
          input.workspaceId,
          input.nodeId,
          current.version,
          JSON.stringify(current.body),
          input.actorUserId,
        ],
      );

      const updated = await client.query<{ version: number }>(
        `update "spatial_documents"
         set "page_mode" = $3::spatial_page_mode,
             "background_kind" = $4::spatial_background_kind,
             "paper_size" = $5,
             "orientation" = $6,
             "settings" = $7::jsonb,
             "version" = "version" + 1,
             "updated_by_user_id" = $8,
             "updated_at" = now()
         where "workspace_id" = $1 and "node_id" = $2
         returning "version"`,
        [
          input.workspaceId,
          input.nodeId,
          spatialBody.document.pageMode,
          spatialBody.document.backgroundKind,
          spatialBody.document.paperSize,
          spatialBody.document.orientation,
          JSON.stringify(spatialBody.document.settings ?? {}),
          input.actorUserId,
        ],
      );
      const restoredRevision = updated.rows[0]?.version;
      if (!restoredRevision) throw new Error("Spatial restore failed.");

      await client.query(
        `delete from "spatial_elements"
         where "workspace_id" = $1 and "node_id" = $2`,
        [input.workspaceId, input.nodeId],
      );
      for (const element of spatialBody.elements) {
        await client.query(
          `insert into "spatial_elements"
             ("id", "workspace_id", "node_id", "type", "x", "y", "width", "height",
              "rotation", "z_rank", "group_id", "locked", "payload",
              "created_by_user_id", "updated_by_user_id")
           values ($1, $2, $3, $4::spatial_element_type, $5, $6, $7, $8, $9, $10,
                   $11, $12, $13::jsonb, $14, $14)`,
          [
            element.id,
            input.workspaceId,
            input.nodeId,
            element.type,
            element.x,
            element.y,
            element.width,
            element.height,
            element.rotation,
            element.zRank,
            element.groupId,
            element.locked,
            JSON.stringify(element.payload ?? {}),
            input.actorUserId,
          ],
        );
      }

      await client.query(
        `insert into "document_versions"
           ("workspace_id", "node_id", "source_revision", "schema_version", "body",
            "reason", "label", "created_by_user_id")
         values ($1, $2, $3, 1, $4::jsonb, 'restore', $5, $6)`,
        [
          input.workspaceId,
          input.nodeId,
          restoredRevision,
          JSON.stringify(spatialBody),
          "Restored version " + historical.id,
          input.actorUserId,
        ],
      );
      await client.query(
        `insert into "outbox_events"
           ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
         values ($1, 'spatial_document', $2, 'document.version_restored', $3::jsonb)`,
        [
          input.workspaceId,
          input.nodeId,
          JSON.stringify({
            nodeId: input.nodeId,
            revision: restoredRevision,
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
          revision: restoredRevision,
          sourceRevision: historical.source_revision,
          documentType: "spatial",
        },
      });
      return {
        revision: restoredRevision,
        body: spatialBody,
        restoredFromVersionId: input.versionId,
      };
    }

    const richBody = historical.body as RichDocumentBody;
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
        JSON.stringify(richBody),
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
        JSON.stringify(richBody),
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
        documentType: "rich",
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
