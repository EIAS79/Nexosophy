import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  ContentStoreError,
  type ContentNode,
  type ContentNodeKind,
  type ContentNodePage,
} from "./content-types.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

type NodeRow = {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  kind: ContentNodeKind;
  name: string;
  target_node_id: string | null;
  metadata: Record<string, unknown>;
  trashed_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
  has_children: boolean;
  favorite?: boolean | null;
  pinned?: boolean | null;
  sort_name?: string;
};

function toNode(row: NodeRow): ContentNode {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    targetNodeId: row.target_node_id,
    metadata: row.metadata ?? {},
    trashedAt: row.trashed_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasChildren: row.has_children,
    ...(row.favorite === undefined || row.favorite === null ? {} : { favorite: row.favorite }),
    ...(row.pinned === undefined || row.pinned === null ? {} : { pinned: row.pinned }),
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

function encodeCursor(sortName: string, id: string): string {
  return Buffer.from(JSON.stringify([sortName, id]), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string): [string | null, string | null] {
  if (!cursor) return [null, null];
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // Normalized below.
  }
  throw new ContentStoreError("NODE_NOT_FOUND", "The page cursor is invalid.");
}

async function selectNode(
  db: Pool | PoolClient,
  workspaceId: string,
  nodeId: string,
  includeTrashed = false,
): Promise<ContentNode | null> {
  const result = await db.query<NodeRow>(
    `select n."id", n."workspace_id", n."parent_id", n."kind", n."name",
            n."target_node_id", n."metadata", n."trashed_at", n."version",
            n."created_at", n."updated_at", lower(trim(n."name")) as "sort_name",
            exists (
              select 1 from "content_nodes" c
              where c."workspace_id" = n."workspace_id"
                and c."parent_id" = n."id"
                and c."trashed_at" is null
            ) as "has_children"
     from "content_nodes" n
     where n."workspace_id" = $1
       and n."id" = $2
       and ($3::boolean or n."trashed_at" is null)
     limit 1`,
    [workspaceId, nodeId, includeTrashed],
  );
  const row = result.rows[0];
  return row ? toNode(row) : null;
}

export async function getContentNode(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
  includeTrashed = false,
): Promise<ContentNode | null> {
  return selectNode(pool, workspaceId, nodeId, includeTrashed);
}

export async function listContentNodes(
  pool: Pool,
  input: {
    workspaceId: string;
    parentId: string | null;
    cursor?: string | undefined;
    limit?: number | undefined;
    includeTrashed?: boolean | undefined;
    userId?: string | undefined;
  },
): Promise<ContentNodePage> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const [cursorName, cursorId] = decodeCursor(input.cursor);
  const result = await pool.query<NodeRow>(
    `select n."id", n."workspace_id", n."parent_id", n."kind", n."name",
            n."target_node_id", n."metadata", n."trashed_at", n."version",
            n."created_at", n."updated_at", lower(trim(n."name")) as "sort_name",
            exists (
              select 1 from "content_nodes" c
              where c."workspace_id" = n."workspace_id"
                and c."parent_id" = n."id"
                and c."trashed_at" is null
            ) as "has_children",
            case when $7::uuid is null then null else (f."node_id" is not null) end as "favorite",
            case when $7::uuid is null then null else coalesce(f."pinned", false) end as "pinned"
     from "content_nodes" n
     left join "content_node_favorites" f
       on f."workspace_id" = n."workspace_id"
      and f."node_id" = n."id"
      and f."user_id" = $7::uuid
     where n."workspace_id" = $1
       and (
         ($2::uuid is null and n."parent_id" is null)
         or n."parent_id" = $2::uuid
       )
       and ($3::boolean or n."trashed_at" is null)
       and (
         $4::text is null
         or lower(trim(n."name")) > $4
         or (lower(trim(n."name")) = $4 and n."id" > $5::uuid)
       )
     order by lower(trim(n."name")), n."id"
     limit $6`,
    [
      input.workspaceId,
      input.parentId,
      input.includeTrashed ?? false,
      cursorName,
      cursorId,
      limit + 1,
      input.userId ?? null,
    ],
  );

  const hasMore = result.rows.length > limit;
  const pageRows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(toNode),
    nextCursor:
      hasMore && last
        ? encodeCursor(last.sort_name ?? last.name.trim().toLowerCase(), last.id)
        : null,
  };
}

export async function assertContentParent(
  db: Pool | PoolClient,
  workspaceId: string,
  parentId: string | null,
): Promise<void> {
  if (!parentId) return;
  const result = await db.query<{ kind: ContentNodeKind; trashed_at: Date | null }>(
    `select "kind", "trashed_at"
     from "content_nodes"
     where "workspace_id" = $1 and "id" = $2
     limit 1`,
    [workspaceId, parentId],
  );
  const row = result.rows[0];
  if (!row || row.trashed_at) {
    throw new ContentStoreError("PARENT_NOT_FOUND", "The destination folder is unavailable.");
  }
  if (row.kind !== "folder") {
    throw new ContentStoreError("PARENT_NOT_FOLDER", "Content can only be placed inside folders.");
  }
}

async function assertShortcutTarget(
  db: Pool | PoolClient,
  workspaceId: string,
  kind: ContentNodeKind,
  targetNodeId: string | null,
): Promise<void> {
  if (kind !== "shortcut") {
    if (targetNodeId) {
      throw new ContentStoreError("TARGET_NOT_FOUND", "Only shortcuts may reference another node.");
    }
    return;
  }
  if (!targetNodeId) {
    throw new ContentStoreError("TARGET_NOT_FOUND", "A shortcut target is required.");
  }
  const target = await db.query(
    `select 1 from "content_nodes"
     where "workspace_id" = $1 and "id" = $2 and "trashed_at" is null
     limit 1`,
    [workspaceId, targetNodeId],
  );
  if ((target.rowCount ?? 0) === 0) {
    throw new ContentStoreError("TARGET_NOT_FOUND", "The shortcut target is unavailable.");
  }
}

export async function createContentNode(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    parentId: string | null;
    kind: ContentNodeKind;
    name: string;
    targetNodeId?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    requestId?: string | undefined;
  },
): Promise<ContentNode> {
  try {
    return await withWorkspaceTransaction(pool, async (client) => {
      await assertContentParent(client, input.workspaceId, input.parentId);
      await assertShortcutTarget(client, input.workspaceId, input.kind, input.targetNodeId ?? null);

      const inserted = await client.query<{ id: string }>(
        `insert into "content_nodes"
           ("workspace_id", "parent_id", "kind", "name", "target_node_id", "metadata",
            "created_by_user_id", "updated_by_user_id")
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
         returning "id"`,
        [
          input.workspaceId,
          input.parentId,
          input.kind,
          input.name.trim(),
          input.targetNodeId ?? null,
          JSON.stringify(input.metadata ?? {}),
          input.actorUserId,
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new Error("Content node insert did not return an ID.");

      await appendWorkspaceAudit(client, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: "content.node_created",
        targetType: "node",
        targetId: id,
        requestId: input.requestId,
        metadata: { kind: input.kind, parentId: input.parentId },
      });

      const node = await selectNode(client, input.workspaceId, id);
      if (!node) throw new Error("Created content node could not be reloaded.");
      return node;
    });
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

export async function updateContentNode(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    expectedVersion: number;
    name?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    requestId?: string | undefined;
  },
): Promise<ContentNode> {
  try {
    return await withWorkspaceTransaction(pool, async (client) => {
      const result = await client.query<{ id: string }>(
        `update "content_nodes"
         set "name" = case when $4::boolean then $5 else "name" end,
             "metadata" = case when $6::boolean then $7::jsonb else "metadata" end,
             "updated_by_user_id" = $8,
             "updated_at" = now(),
             "version" = "version" + 1
         where "workspace_id" = $1
           and "id" = $2
           and "version" = $3
           and "trashed_at" is null
         returning "id"`,
        [
          input.workspaceId,
          input.nodeId,
          input.expectedVersion,
          input.name !== undefined,
          input.name?.trim() ?? "",
          input.metadata !== undefined,
          JSON.stringify(input.metadata ?? {}),
          input.actorUserId,
        ],
      );

      if (!result.rows[0]) {
        const exists = await client.query(
          `select 1 from "content_nodes"
           where "workspace_id" = $1 and "id" = $2 and "trashed_at" is null`,
          [input.workspaceId, input.nodeId],
        );
        if ((exists.rowCount ?? 0) === 0) {
          throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
        }
        throw new ContentStoreError(
          "VERSION_CONFLICT",
          "The content node changed before this update was applied.",
        );
      }

      await appendWorkspaceAudit(client, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: "content.node_updated",
        targetType: "node",
        targetId: input.nodeId,
        requestId: input.requestId,
        metadata: {
          renamed: input.name !== undefined,
          metadataUpdated: input.metadata !== undefined,
        },
      });

      const node = await selectNode(client, input.workspaceId, input.nodeId);
      if (!node) throw new Error("Updated content node could not be reloaded.");
      return node;
    });
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

export async function moveContentNode(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    parentId: string | null;
    expectedVersion: number;
    requestId?: string | undefined;
    idempotencyKey?: string | undefined;
  },
): Promise<ContentNode> {
  try {
    return await withWorkspaceTransaction(pool, async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `content-tree:${input.workspaceId}`,
      ]);

      const requestHash = input.idempotencyKey
        ? createHash("sha256")
            .update(
              JSON.stringify({
                operation: "move",
                nodeId: input.nodeId,
                parentId: input.parentId,
              }),
            )
            .digest("hex")
        : null;

      if (input.idempotencyKey && requestHash) {
        await client.query(
          `delete from "content_idempotency"
           where "workspace_id" = $1 and "idempotency_key" = $2 and "expires_at" <= now()`,
          [input.workspaceId, input.idempotencyKey],
        );
        const replay = await client.query<{ request_hash: string }>(
          `select "request_hash"
           from "content_idempotency"
           where "workspace_id" = $1 and "idempotency_key" = $2
           for update`,
          [input.workspaceId, input.idempotencyKey],
        );
        const existing = replay.rows[0];
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ContentStoreError(
              "IDEMPOTENCY_CONFLICT",
              "The idempotency key was already used for a different content move.",
            );
          }
          const replayed = await selectNode(client, input.workspaceId, input.nodeId);
          if (!replayed) {
            throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
          }
          return replayed;
        }
      }

      const source = await client.query<{ version: number }>(
        `select "version" from "content_nodes"
         where "workspace_id" = $1 and "id" = $2 and "trashed_at" is null
         for update`,
        [input.workspaceId, input.nodeId],
      );
      const sourceRow = source.rows[0];
      if (!sourceRow) {
        throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
      }
      if (sourceRow.version !== input.expectedVersion) {
        throw new ContentStoreError(
          "VERSION_CONFLICT",
          "The content node changed before this move was applied.",
        );
      }

      await assertContentParent(client, input.workspaceId, input.parentId);

      if (input.parentId) {
        const cycle = await client.query(
          `with recursive descendants as (
             select "id"
             from "content_nodes"
             where "workspace_id" = $1 and "id" = $2
             union all
             select child."id"
             from "content_nodes" child
             join descendants parent on child."parent_id" = parent."id"
             where child."workspace_id" = $1
           )
           select 1 from descendants where "id" = $3 limit 1`,
          [input.workspaceId, input.nodeId, input.parentId],
        );
        if ((cycle.rowCount ?? 0) > 0) {
          throw new ContentStoreError("CYCLE", "A folder cannot be moved into its own subtree.");
        }
      }

      const moved = await client.query(
        `update "content_nodes"
         set "parent_id" = $3,
             "updated_by_user_id" = $4,
             "updated_at" = now(),
             "version" = "version" + 1
         where "workspace_id" = $1 and "id" = $2 and "version" = $5
         returning "id"`,
        [input.workspaceId, input.nodeId, input.parentId, input.actorUserId, input.expectedVersion],
      );
      if ((moved.rowCount ?? 0) !== 1) {
        throw new ContentStoreError(
          "VERSION_CONFLICT",
          "The content node changed before this move was applied.",
        );
      }

      await appendWorkspaceAudit(client, {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: "content.node_moved",
        targetType: "node",
        targetId: input.nodeId,
        requestId: input.requestId,
        metadata: { parentId: input.parentId },
      });

      const node = await selectNode(client, input.workspaceId, input.nodeId);
      if (!node) throw new Error("Moved content node could not be reloaded.");

      if (input.idempotencyKey && requestHash) {
        await client.query(
          `insert into "content_idempotency"
             ("workspace_id", "idempotency_key", "request_hash", "response")
           values ($1, $2, $3, $4::jsonb)`,
          [
            input.workspaceId,
            input.idempotencyKey,
            requestHash,
            JSON.stringify({ nodeId: node.id, version: node.version }),
          ],
        );
      }

      return node;
    });
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

export async function getContentBreadcrumbs(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
): Promise<ContentNode[]> {
  const result = await pool.query<NodeRow & { depth: number }>(
    `with recursive ancestors as (
       select n.*, 0 as "depth"
       from "content_nodes" n
       where n."workspace_id" = $1 and n."id" = $2 and n."trashed_at" is null
       union all
       select parent.*, child."depth" + 1
       from "content_nodes" parent
       join ancestors child on child."parent_id" = parent."id"
       where parent."workspace_id" = $1 and parent."trashed_at" is null
     )
     select a."id", a."workspace_id", a."parent_id", a."kind", a."name",
            a."target_node_id", a."metadata", a."trashed_at", a."version",
            a."created_at", a."updated_at", a."depth",
            exists (
              select 1 from "content_nodes" c
              where c."workspace_id" = a."workspace_id"
                and c."parent_id" = a."id"
                and c."trashed_at" is null
            ) as "has_children"
     from ancestors a
     order by a."depth" desc`,
    [workspaceId, nodeId],
  );
  if (result.rows.length === 0 || result.rows[0]?.trashed_at) {
    throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
  }
  return result.rows.map(toNode);
}

export async function resolveContentPath(
  pool: Pool,
  workspaceId: string,
  path: string,
): Promise<ContentNode | null> {
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  let parentId: string | null = null;
  let current: ContentNode | null = null;

  for (const segment of segments) {
    const result = await pool.query<NodeRow>(
      `select n."id", n."workspace_id", n."parent_id", n."kind", n."name",
              n."target_node_id", n."metadata", n."trashed_at", n."version",
              n."created_at", n."updated_at",
              exists (
                select 1 from "content_nodes" c
                where c."workspace_id" = n."workspace_id"
                  and c."parent_id" = n."id"
                  and c."trashed_at" is null
              ) as "has_children"
       from "content_nodes" n
       where n."workspace_id" = $1
         and (($2::uuid is null and n."parent_id" is null) or n."parent_id" = $2::uuid)
         and lower(trim(n."name")) = lower(trim($3))
         and n."trashed_at" is null
       limit 1`,
      [workspaceId, parentId, segment],
    );
    const row = result.rows[0];
    if (!row) return null;
    current = toNode(row);
    parentId = current.id;
  }

  return current;
}

export async function setContentFavorite(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    nodeId: string;
    favorite: boolean;
    pinned: boolean;
  },
): Promise<void> {
  const node = await getContentNode(pool, input.workspaceId, input.nodeId);
  if (!node) throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");

  if (!input.favorite) {
    await pool.query(
      `delete from "content_node_favorites"
       where "workspace_id" = $1 and "user_id" = $2 and "node_id" = $3`,
      [input.workspaceId, input.userId, input.nodeId],
    );
    return;
  }

  await pool.query(
    `insert into "content_node_favorites"
       ("workspace_id", "user_id", "node_id", "pinned", "pin_position")
     values (
       $1, $2, $3, $4,
       case when $4::boolean then (
         select coalesce(max("pin_position"), -1) + 1
         from "content_node_favorites"
         where "workspace_id" = $1 and "user_id" = $2 and "pinned" = true
       ) else null end
     )
     on conflict ("workspace_id", "user_id", "node_id")
     do update set
       "pinned" = excluded."pinned",
       "pin_position" = case
         when excluded."pinned" and "content_node_favorites"."pin_position" is null
           then (
             select coalesce(max(f."pin_position"), -1) + 1
             from "content_node_favorites" f
             where f."workspace_id" = $1 and f."user_id" = $2 and f."pinned" = true
           )
         when excluded."pinned" then "content_node_favorites"."pin_position"
         else null
       end,
       "updated_at" = now()`,
    [input.workspaceId, input.userId, input.nodeId, input.pinned],
  );
}

export async function listContentFavorites(
  pool: Pool,
  workspaceId: string,
  userId: string,
  limit = 50,
): Promise<ContentNode[]> {
  const result = await pool.query<NodeRow>(
    `select n."id", n."workspace_id", n."parent_id", n."kind", n."name",
            n."target_node_id", n."metadata", n."trashed_at", n."version",
            n."created_at", n."updated_at", lower(trim(n."name")) as "sort_name",
            exists (
              select 1 from "content_nodes" c
              where c."workspace_id" = n."workspace_id"
                and c."parent_id" = n."id"
                and c."trashed_at" is null
            ) as "has_children",
            true as "favorite",
            f."pinned"
     from "content_node_favorites" f
     join "content_nodes" n
       on n."workspace_id" = f."workspace_id" and n."id" = f."node_id"
     where f."workspace_id" = $1 and f."user_id" = $2 and n."trashed_at" is null
     order by f."pinned" desc, f."pin_position" nulls last, f."updated_at" desc, n."id"
     limit $3`,
    [workspaceId, userId, Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map(toNode);
}

export async function markContentRecent(
  pool: Pool,
  workspaceId: string,
  userId: string,
  nodeId: string,
): Promise<void> {
  const node = await getContentNode(pool, workspaceId, nodeId);
  if (!node) throw new ContentStoreError("NODE_NOT_FOUND", "Content node not found.");
  await pool.query(
    `insert into "content_node_recent" ("workspace_id", "user_id", "node_id")
     values ($1, $2, $3)
     on conflict ("workspace_id", "user_id", "node_id")
     do update set
       "open_count" = "content_node_recent"."open_count" + 1,
       "last_opened_at" = now()`,
    [workspaceId, userId, nodeId],
  );
}

export async function listContentRecent(
  pool: Pool,
  workspaceId: string,
  userId: string,
  limit = 50,
): Promise<ContentNode[]> {
  const result = await pool.query<NodeRow>(
    `select n."id", n."workspace_id", n."parent_id", n."kind", n."name",
            n."target_node_id", n."metadata", n."trashed_at", n."version",
            n."created_at", n."updated_at", lower(trim(n."name")) as "sort_name",
            exists (
              select 1 from "content_nodes" c
              where c."workspace_id" = n."workspace_id"
                and c."parent_id" = n."id"
                and c."trashed_at" is null
            ) as "has_children"
     from "content_node_recent" r
     join "content_nodes" n
       on n."workspace_id" = r."workspace_id" and n."id" = r."node_id"
     where r."workspace_id" = $1 and r."user_id" = $2 and n."trashed_at" is null
     order by r."last_opened_at" desc, n."id" desc
     limit $3`,
    [workspaceId, userId, Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map(toNode);
}