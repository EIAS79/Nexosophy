import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  ContentStoreError,
  type ContentBulkResult,
  type ContentNode,
  type ContentNodeKind,
  type ContentOperation,
  type ContentOperationStatus,
  type ContentOperationType,
} from "./content-types.js";
import { assertContentParent, getContentNode, moveContentNode } from "./content-store-core.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export const CONTENT_SYNC_SUBTREE_LIMIT = 500;
export const CONTENT_JOB_BATCH_SIZE = 200;

type OperationRow = {
  id: string;
  workspace_id: string;
  operation: ContentOperationType;
  status: ContentOperationStatus;
  root_node_id: string;
  target_parent_id: string | null;
  processed_nodes: number;
  total_nodes: number;
  attempts: number;
  max_attempts: number;
  error_code: string | null;
  error_message: string | null;
};

type CopyRow = {
  id: string;
  parent_id: string | null;
  kind: ContentNodeKind;
  name: string;
  target_node_id: string | null;
  metadata: Record<string, unknown>;
  depth: number;
};

export type ContentMutationResult =
  | { status: "completed"; affected: number; node?: ContentNode }
  | { status: "queued"; operation: ContentOperation };

function toOperation(row: OperationRow): ContentOperation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    operation: row.operation,
    status: row.status,
    rootNodeId: row.root_node_id,
    targetParentId: row.target_parent_id,
    processedNodes: row.processed_nodes,
    totalNodes: row.total_nodes,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  };
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

async function countSubtree(
  db: Pool | PoolClient,
  workspaceId: string,
  nodeId: string,
  includeTrashed: boolean,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `with recursive subtree as (
       select "id"
       from "content_nodes"
       where "workspace_id" = $1
         and "id" = $2
         and ($3::boolean or "trashed_at" is null)
       union all
       select child."id"
       from "content_nodes" child
       join subtree parent on child."parent_id" = parent."id"
       where child."workspace_id" = $1
         and ($3::boolean or child."trashed_at" is null)
     )
     select count(*)::text as "count" from subtree`,
    [workspaceId, nodeId, includeTrashed],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function countContentSubtree(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
): Promise<number> {
  return countSubtree(pool, workspaceId, nodeId, false);
}

async function selectOperation(
  db: Pool | PoolClient,
  workspaceId: string,
  jobId: string,
): Promise<ContentOperation | null> {
  const result = await db.query<OperationRow>(
    `select "id", "workspace_id", "operation", "status", "root_node_id",
            "target_parent_id", "processed_nodes", "total_nodes", "attempts",
            "max_attempts", "error_code", "error_message"
     from "content_operation_jobs"
     where "workspace_id" = $1 and "id" = $2
     limit 1`,
    [workspaceId, jobId],
  );
  const row = result.rows[0];
  return row ? toOperation(row) : null;
}

export async function getContentOperation(
  pool: Pool,
  workspaceId: string,
  jobId: string,
): Promise<ContentOperation | null> {
  return selectOperation(pool, workspaceId, jobId);
}

async function enqueueOperation(
  client: PoolClient,
  input: {
    workspaceId: string;
    actorUserId: string;
    operation: ContentOperationType;
    rootNodeId: string;
    targetParentId: string | null;
    name?: string | undefined;
    idempotencyKey?: string | undefined;
  },
): Promise<ContentOperation> {
  if (input.idempotencyKey) {
    const existing = await client.query<OperationRow & { payload: Record<string, unknown> }>(
      `select "id", "workspace_id", "operation", "status", "root_node_id",
              "target_parent_id", "processed_nodes", "total_nodes", "attempts",
              "max_attempts", "error_code", "error_message", "payload"
       from "content_operation_jobs"
       where "workspace_id" = $1 and "idempotency_key" = $2
       limit 1`,
      [input.workspaceId, input.idempotencyKey],
    );
    const row = existing.rows[0];
    if (row) {
      if (
        row.operation !== input.operation ||
        row.root_node_id !== input.rootNodeId ||
        row.target_parent_id !== input.targetParentId ||
        (row.payload.name ?? undefined) !== input.name
      ) {
        throw new ContentStoreError(
          "IDEMPOTENCY_CONFLICT",
          "The idempotency key was already used for a different content operation.",
        );
      }
      return toOperation(row);
    }
  }

  const inserted = await client.query<OperationRow>(
    `insert into "content_operation_jobs"
       ("workspace_id", "operation", "root_node_id", "target_parent_id", "payload",
        "idempotency_key", "created_by_user_id")
     values ($1, $2, $3, $4, $5::jsonb, $6, $7)
     returning "id", "workspace_id", "operation", "status", "root_node_id",
               "target_parent_id", "processed_nodes", "total_nodes", "attempts",
               "max_attempts", "error_code", "error_message"`,
    [
      input.workspaceId,
      input.operation,
      input.rootNodeId,
      input.targetParentId,
      JSON.stringify(input.name ? { name: input.name } : {}),
      input.idempotencyKey ?? null,
      input.actorUserId,
    ],
  );
  const job = inserted.rows[0];
  if (!job) throw new Error("Content operation insert did not return a row.");

  const items = await client.query<{ count: string }>(
    `with recursive subtree as (
       select n."id", n."parent_id", 0 as "depth"
       from "content_nodes" n
       where n."workspace_id" = $1
         and n."id" = $2
         and (
           ($4::content_operation_type = 'restore_subtree' and n."trashed_at" is not null)
           or ($4::content_operation_type <> 'restore_subtree' and n."trashed_at" is null)
         )
       union all
       select child."id", child."parent_id", parent."depth" + 1
       from "content_nodes" child
       join subtree parent on child."parent_id" = parent."id"
       where child."workspace_id" = $1
         and (
           ($4::content_operation_type = 'restore_subtree' and child."trashed_at" is not null)
           or ($4::content_operation_type <> 'restore_subtree' and child."trashed_at" is null)
         )
     ), inserted_items as (
       insert into "content_operation_items"
         ("job_id", "workspace_id", "source_node_id", "source_parent_id",
          "destination_node_id", "depth")
       select $3, $1, "id", "parent_id",
              case when $4::content_operation_type = 'copy_subtree'
                then gen_random_uuid() else null end,
              "depth"
       from subtree
       returning 1
     )
     select count(*)::text as "count" from inserted_items`,
    [input.workspaceId, input.rootNodeId, job.id, input.operation],
  );
  const total = Number(items.rows[0]?.count ?? 0);
  if (total === 0) {
    throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
  }

  const updated = await client.query<OperationRow>(
    `update "content_operation_jobs"
     set "total_nodes" = $3, "updated_at" = now()
     where "workspace_id" = $1 and "id" = $2
     returning "id", "workspace_id", "operation", "status", "root_node_id",
               "target_parent_id", "processed_nodes", "total_nodes", "attempts",
               "max_attempts", "error_code", "error_message"`,
    [input.workspaceId, job.id, total],
  );
  const ready = updated.rows[0];
  if (!ready) throw new Error("Content operation could not be initialized.");
  return toOperation(ready);
}

async function loadSubtreeForCopy(
  client: PoolClient,
  workspaceId: string,
  nodeId: string,
): Promise<CopyRow[]> {
  const result = await client.query<CopyRow>(
    `with recursive subtree as (
       select n."id", n."parent_id", n."kind", n."name", n."target_node_id",
              n."metadata", 0 as "depth"
       from "content_nodes" n
       where n."workspace_id" = $1 and n."id" = $2 and n."trashed_at" is null
       union all
       select child."id", child."parent_id", child."kind", child."name",
              child."target_node_id", child."metadata", parent."depth" + 1
       from "content_nodes" child
       join subtree parent on child."parent_id" = parent."id"
       where child."workspace_id" = $1 and child."trashed_at" is null
     )
     select * from subtree order by "depth", "id" limit $3`,
    [workspaceId, nodeId, CONTENT_SYNC_SUBTREE_LIMIT + 1],
  );
  return result.rows;
}

export async function copyContentSubtree(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    nodeId: string;
    parentId: string | null;
    name?: string | undefined;
    requestId?: string | undefined;
    idempotencyKey?: string | undefined;
  },
): Promise<ContentMutationResult> {
  try {
    const result = await withWorkspaceTransaction(pool, async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `content-tree:${input.workspaceId}`,
      ]);
      await assertContentParent(client, input.workspaceId, input.parentId);

      const rows = await loadSubtreeForCopy(client, input.workspaceId, input.nodeId);
      if (rows.length === 0) {
        throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
      }
      if (rows.length > CONTENT_SYNC_SUBTREE_LIMIT) {
        const operation = await enqueueOperation(client, {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          operation: "copy_subtree",
          rootNodeId: input.nodeId,
          targetParentId: input.parentId,
          name: input.name,
          idempotencyKey: input.idempotencyKey,
        });
        return { status: "queued" as const, operation };
      }

      const idMap = new Map(rows.map((row) => [row.id, randomUUID()]));
      const root = rows[0];
      if (!root) throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");

      for (const row of rows) {
        const destinationId = idMap.get(row.id);
        if (!destinationId) throw new Error("Copy mapping is incomplete.");
        const parentId =
          row.depth === 0
            ? input.parentId
            : row.parent_id
              ? (idMap.get(row.parent_id) ?? null)
              : null;
        const targetNodeId = row.target_node_id;
        await client.query(
          `insert into "content_nodes"
             ("id", "workspace_id", "parent_id", "kind", "name", "target_node_id",
              "metadata", "created_by_user_id", "updated_by_user_id")
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)`,
          [
            destinationId,
            input.workspaceId,
            parentId,
            row.kind,
            row.depth === 0 && input.name ? input.name.trim() : row.name,
            targetNodeId,
            JSON.stringify(row.metadata ?? {}),
            input.actorUserId,
          ],
        );
      }

      const rootId = idMap.get(root.id);
      if (!rootId) throw new Error("Copied root mapping is unavailable.");

      await appendWorkspaceAudit(client, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: "content.subtree_copied",
        targetType: "node",
        targetId: rootId,
        requestId: input.requestId,
        metadata: { sourceNodeId: input.nodeId, nodeCount: rows.length },
      });

      return {
        status: "completed" as const,
        affected: rows.length,
        copiedRootId: rootId,
      };
    });

    if (result.status === "completed" && result.copiedRootId) {
      const node = await getContentNode(pool, input.workspaceId, result.copiedRootId);
      if (!node) throw new Error("Copied root could not be reloaded.");
      return { status: "completed", affected: result.affected, node };
    }
    return result;
  } catch (error) {
    if (isPgCode(error, "23505")) {
      throw new ContentStoreError(
        "NAME_CONFLICT",
        "An active item with this name already exists in that folder.",
      );
    }
    throw error;
  }
}

export async function trashContentSubtree(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    nodeId: string;
    requestId?: string | undefined;
    idempotencyKey?: string | undefined;
  },
): Promise<ContentMutationResult> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `content-tree:${input.workspaceId}`,
    ]);
    const total = await countSubtree(client, input.workspaceId, input.nodeId, false);
    if (total === 0) {
      throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
    }

    if (total > CONTENT_SYNC_SUBTREE_LIMIT) {
      const operation = await enqueueOperation(client, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        operation: "trash_subtree",
        rootNodeId: input.nodeId,
        targetParentId: null,
        idempotencyKey: input.idempotencyKey,
      });
      return { status: "queued", operation };
    }

    const result = await client.query(
      `with recursive subtree as (
         select "id" from "content_nodes"
         where "workspace_id" = $1 and "id" = $2 and "trashed_at" is null
         union all
         select child."id"
         from "content_nodes" child
         join subtree parent on child."parent_id" = parent."id"
         where child."workspace_id" = $1 and child."trashed_at" is null
       )
       update "content_nodes" n
       set "original_parent_id" = n."parent_id",
           "trashed_at" = now(),
           "trashed_by_user_id" = $3,
           "updated_by_user_id" = $3,
           "updated_at" = now(),
           "version" = n."version" + 1
       from subtree s
       where n."workspace_id" = $1 and n."id" = s."id"`,
      [input.workspaceId, input.nodeId, input.actorUserId],
    );

    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "content.subtree_trashed",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: { nodeCount: result.rowCount ?? total },
    });
    return { status: "completed", affected: result.rowCount ?? total };
  });
}

export async function restoreContentSubtree(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    nodeId: string;
    requestId?: string | undefined;
    idempotencyKey?: string | undefined;
  },
): Promise<ContentMutationResult> {
  try {
    return await withWorkspaceTransaction(pool, async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `content-tree:${input.workspaceId}`,
      ]);
      const root = await client.query<{
        parent_id: string | null;
        original_parent_id: string | null;
      }>(
        `select "parent_id", "original_parent_id"
         from "content_nodes"
         where "workspace_id" = $1 and "id" = $2 and "trashed_at" is not null
         for update`,
        [input.workspaceId, input.nodeId],
      );
      const rootRow = root.rows[0];
      if (!rootRow) {
        throw new ContentStoreError("NODE_NOT_FOUND", "Trashed content node not found.");
      }

      const total = await countSubtree(client, input.workspaceId, input.nodeId, true);
      const preferredParent = rootRow.original_parent_id ?? rootRow.parent_id;
      let restoreParent = preferredParent;
      if (preferredParent) {
        const parent = await client.query(
          `select 1 from "content_nodes"
           where "workspace_id" = $1 and "id" = $2 and "kind" = 'folder'
             and "trashed_at" is null`,
          [input.workspaceId, preferredParent],
        );
        if ((parent.rowCount ?? 0) === 0) restoreParent = null;
      }

      if (total > CONTENT_SYNC_SUBTREE_LIMIT) {
        const operation = await enqueueOperation(client, {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          operation: "restore_subtree",
          rootNodeId: input.nodeId,
          targetParentId: restoreParent,
          idempotencyKey: input.idempotencyKey,
        });
        return { status: "queued", operation };
      }

      await client.query(
        `update "content_nodes"
         set "parent_id" = $3
         where "workspace_id" = $1 and "id" = $2`,
        [input.workspaceId, input.nodeId, restoreParent],
      );
      const restored = await client.query(
        `with recursive subtree as (
           select "id" from "content_nodes"
           where "workspace_id" = $1 and "id" = $2
           union all
           select child."id"
           from "content_nodes" child
           join subtree parent on child."parent_id" = parent."id"
           where child."workspace_id" = $1 and child."trashed_at" is not null
         )
         update "content_nodes" n
         set "original_parent_id" = null,
             "trashed_at" = null,
             "trashed_by_user_id" = null,
             "updated_by_user_id" = $3,
             "updated_at" = now(),
             "version" = n."version" + 1
         from subtree s
         where n."workspace_id" = $1 and n."id" = s."id"`,
        [input.workspaceId, input.nodeId, input.actorUserId],
      );

      await appendWorkspaceAudit(client, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: "content.subtree_restored",
        targetType: "node",
        targetId: input.nodeId,
        requestId: input.requestId,
        metadata: { nodeCount: restored.rowCount ?? total, parentId: restoreParent },
      });
      return { status: "completed", affected: restored.rowCount ?? total };
    });
  } catch (error) {
    if (isPgCode(error, "23505")) {
      throw new ContentStoreError(
        "NAME_CONFLICT",
        "The original folder already contains an active item with this name.",
      );
    }
    throw error;
  }
}

export async function bulkContentNodes(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    operation: "move" | "copy" | "trash";
    nodeIds: string[];
    parentId?: string | null | undefined;
    requestId?: string | undefined;
    idempotencyKey?: string | undefined;
  },
): Promise<ContentBulkResult> {
  const completed: string[] = [];
  const queued: ContentOperation[] = [];

  for (const [index, nodeId] of input.nodeIds.entries()) {
    const perNodeKey = input.idempotencyKey ? `${input.idempotencyKey}:${index}` : undefined;
    if (input.operation === "move") {
      const node = await getContentNode(pool, input.workspaceId, nodeId);
      if (!node) throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
      await moveContentNode(pool, {
        workspaceId: input.workspaceId,
        nodeId,
        actorUserId: input.actorUserId,
        parentId: input.parentId ?? null,
        expectedVersion: node.version,
        requestId: input.requestId,
        idempotencyKey: perNodeKey,
      });
      completed.push(nodeId);
      continue;
    }

    if (input.operation === "copy") {
      const result = await copyContentSubtree(pool, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        nodeId,
        parentId: input.parentId ?? null,
        requestId: input.requestId,
        idempotencyKey: perNodeKey,
      });
      if (result.status === "queued") queued.push(result.operation);
      else completed.push(nodeId);
      continue;
    }

    const result = await trashContentSubtree(pool, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      nodeId,
      requestId: input.requestId,
      idempotencyKey: perNodeKey,
    });
    if (result.status === "queued") queued.push(result.operation);
    else completed.push(nodeId);
  }

  return { completed, queued };
}

export async function claimNextContentOperation(
  pool: Pool,
  workerId: string,
): Promise<ContentOperation | null> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "content_operation_jobs"
       set "status" = 'failed',
           "error_code" = coalesce("error_code", 'MAX_ATTEMPTS_EXCEEDED'),
           "error_message" = coalesce("error_message", 'The operation exhausted its retry budget.'),
           "locked_at" = null,
           "locked_by" = null,
           "updated_at" = now()
       where "status" = 'running'
         and "locked_at" < now() - interval '5 minutes'
         and "attempts" >= "max_attempts"`,
    );

    const selected = await client.query<{ id: string }>(
      `select "id"
       from "content_operation_jobs"
       where (
         "status" = 'queued'
         or ("status" = 'running' and "locked_at" < now() - interval '5 minutes')
       )
         and "attempts" < "max_attempts"
       order by "created_at", "id"
       for update skip locked
       limit 1`,
    );
    const id = selected.rows[0]?.id;
    if (!id) return null;

    const updated = await client.query<OperationRow>(
      `update "content_operation_jobs"
       set "status" = 'running',
           "locked_at" = now(),
           "locked_by" = $2,
           "attempts" = "attempts" + 1,
           "updated_at" = now()
       where "id" = $1
       returning "id", "workspace_id", "operation", "status", "root_node_id",
                 "target_parent_id", "processed_nodes", "total_nodes", "attempts",
                 "max_attempts", "error_code", "error_message"`,
      [id, workerId],
    );
    const row = updated.rows[0];
    return row ? toOperation(row) : null;
  });
}

export async function processContentOperationBatch(
  pool: Pool,
  jobId: string,
  batchSize = CONTENT_JOB_BATCH_SIZE,
): Promise<ContentOperation> {
  try {
    return await withWorkspaceTransaction(pool, async (client) => {
      const locked = await client.query<
        OperationRow & { created_by_user_id: string; payload: Record<string, unknown> }
      >(
        `select "id", "workspace_id", "operation", "status", "root_node_id",
                "target_parent_id", "processed_nodes", "total_nodes", "attempts",
                "max_attempts", "error_code", "error_message", "created_by_user_id", "payload"
         from "content_operation_jobs"
         where "id" = $1
         for update`,
        [jobId],
      );
      const job = locked.rows[0];
      if (!job) throw new ContentStoreError("OPERATION_NOT_FOUND", "Content operation not found.");
      if (job.status === "cancelled") {
        throw new ContentStoreError("OPERATION_CANCELLED", "Content operation was cancelled.");
      }
      if (job.status === "succeeded" || job.status === "failed") return toOperation(job);

      const take = Math.min(Math.max(batchSize, 1), 500);
      let processed = 0;

      if (job.operation === "copy_subtree") {
        await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
          `content-tree:${job.workspace_id}`,
        ]);
        await assertContentParent(client, job.workspace_id, job.target_parent_id);

        if (job.processed_nodes > 0) {
          const copiedRoot = await client.query(
            `select 1
             from "content_operation_items" i
             join "content_nodes" n
               on n."workspace_id" = i."workspace_id"
              and n."id" = i."destination_node_id"
             where i."job_id" = $1
               and i."depth" = 0
               and n."trashed_at" is null
             limit 1`,
            [jobId],
          );
          if ((copiedRoot.rowCount ?? 0) === 0) {
            throw new ContentStoreError(
              "PARENT_NOT_FOUND",
              "The copied subtree root is no longer available.",
            );
          }
        }

        const result = await client.query(
          `with batch as (
             select i."job_id", i."workspace_id", i."source_node_id", i."source_parent_id",
                    i."destination_node_id", i."depth"
             from "content_operation_items" i
             where i."job_id" = $1 and i."processed" = false
             order by i."depth", i."source_node_id"
             limit $2
           ), copied as (
             insert into "content_nodes"
               ("id", "workspace_id", "parent_id", "kind", "name", "target_node_id",
                "metadata", "created_by_user_id", "updated_by_user_id")
             select b."destination_node_id",
                    source."workspace_id",
                    case when b."depth" = 0
                      then job."target_parent_id"
                      else parent_map."destination_node_id"
                    end,
                    source."kind",
                    case when b."depth" = 0 and nullif(job."payload" ->> 'name', '') is not null
                      then job."payload" ->> 'name'
                      else source."name"
                    end,
                    source."target_node_id",
                    source."metadata",
                    job."created_by_user_id",
                    job."created_by_user_id"
             from batch b
             join "content_operation_jobs" job on job."id" = b."job_id"
             join "content_nodes" source
               on source."workspace_id" = b."workspace_id" and source."id" = b."source_node_id"
             left join "content_operation_items" parent_map
               on parent_map."job_id" = b."job_id"
              and parent_map."source_node_id" = b."source_parent_id"
             left join "content_operation_items" target_map
               on target_map."job_id" = b."job_id"
              and target_map."source_node_id" = source."target_node_id"
             returning "id"
           )
           update "content_operation_items" i
           set "processed" = true, "processed_at" = now()
           from batch b
           where i."job_id" = b."job_id" and i."source_node_id" = b."source_node_id"
           returning i."source_node_id"`,
          [jobId, take],
        );
        processed = result.rowCount ?? 0;
      } else {
        const restoring = job.operation === "restore_subtree";
        if (restoring && job.processed_nodes === 0) {
          await client.query(
            `update "content_nodes"
             set "parent_id" = $3
             where "workspace_id" = $1 and "id" = $2`,
            [job.workspace_id, job.root_node_id, job.target_parent_id],
          );
        }

        const result = await client.query(
          `with batch as (
             select "source_node_id"
             from "content_operation_items"
             where "job_id" = $1 and "processed" = false
             order by "depth", "source_node_id"
             limit $2
           ), changed as (
             update "content_nodes" n
             set "original_parent_id" = case
                   when $4::boolean then null
                   else n."parent_id"
                 end,
                 "trashed_at" = case when $4::boolean then null else now() end,
                 "trashed_by_user_id" = case when $4::boolean then null else $3::uuid end,
                 "updated_by_user_id" = $3,
                 "updated_at" = now(),
                 "version" = n."version" + 1
             from batch b
             where n."id" = b."source_node_id" and n."workspace_id" = $5
             returning n."id"
           )
           update "content_operation_items" i
           set "processed" = true, "processed_at" = now()
           from batch b
           where i."job_id" = $1 and i."source_node_id" = b."source_node_id"
           returning i."source_node_id"`,
          [jobId, take, job.created_by_user_id, restoring, job.workspace_id],
        );
        processed = result.rowCount ?? 0;
      }

      const nextProcessed = Math.min(job.processed_nodes + processed, job.total_nodes);
      const complete = nextProcessed >= job.total_nodes;
      const updated = await client.query<OperationRow>(
        `update "content_operation_jobs"
         set "processed_nodes" = $2,
             "status" = case when $3::boolean then 'succeeded'::content_operation_status else 'running'::content_operation_status end,
             "locked_at" = case when $3::boolean then null else now() end,
             "locked_by" = case when $3::boolean then null else "locked_by" end,
             "updated_at" = now()
         where "id" = $1
         returning "id", "workspace_id", "operation", "status", "root_node_id",
                   "target_parent_id", "processed_nodes", "total_nodes", "attempts",
                   "max_attempts", "error_code", "error_message"`,
        [jobId, nextProcessed, complete],
      );
      const row = updated.rows[0];
      if (!row) throw new Error("Content operation progress could not be persisted.");

      if (complete) {
        await appendWorkspaceAudit(client, {
          workspaceId: job.workspace_id,
          actorUserId: job.created_by_user_id,
          action: `content.${job.operation}_completed`,
          targetType: "node",
          targetId: job.root_node_id,
          metadata: { nodeCount: job.total_nodes, jobId },
        });
      }
      return toOperation(row);
    });
  } catch (error) {
    if (isPgCode(error, "23505")) {
      throw new ContentStoreError(
        "NAME_CONFLICT",
        "The content operation encountered a sibling name conflict.",
      );
    }
    throw error;
  }
}

export async function failContentOperation(
  pool: Pool,
  jobId: string,
  input: { code: string; message: string; retryable: boolean },
): Promise<void> {
  await pool.query(
    `update "content_operation_jobs"
     set "status" = case
           when $2::boolean and "attempts" < "max_attempts"
             then 'queued'::content_operation_status
           else 'failed'::content_operation_status
         end,
         "error_code" = $3,
         "error_message" = left($4, 1000),
         "locked_at" = null,
         "locked_by" = null,
         "updated_at" = now()
     where "id" = $1 and "status" = 'running'`,
    [jobId, input.retryable, input.code, input.message],
  );
}