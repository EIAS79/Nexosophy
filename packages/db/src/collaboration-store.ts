import { createHash } from "node:crypto";

import type { Pool } from "pg";

import { materializeSpatialRegisters } from "./spatial-store.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export type CrdtRegister = {
  key: string;
  value?: unknown;
  deleted: boolean;
  lamport: number;
  actor: string;
};

export type CollaborationUpdateRecord = {
  id: string;
  sequence: number;
  clientId: string;
  clientClock: number;
  registers: CrdtRegister[];
  createdAt: Date;
};

export type CollaborationRoomState = {
  roomId: string;
  workspaceId: string;
  nodeId: string;
  protocol: string;
  checkpoint: { registers: Record<string, CrdtRegister> };
  checkpointSequence: number;
  version: number;
  updates: CollaborationUpdateRecord[];
};

function wins(next: CrdtRegister, current?: CrdtRegister): boolean {
  if (!current) return true;
  if (next.lamport !== current.lamport) return next.lamport > current.lamport;
  return next.actor.localeCompare(current.actor) > 0;
}

function mergeRegisters(
  base: { registers: Record<string, CrdtRegister> },
  updates: readonly CollaborationUpdateRecord[],
): { registers: Record<string, CrdtRegister> } {
  const registers = { ...(base.registers ?? {}) };
  for (const update of updates) {
    for (const register of update.registers) {
      if (wins(register, registers[register.key])) {
        registers[register.key] = register;
      }
    }
  }
  return { registers };
}

async function ensureRoom(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
): Promise<{ id: string; protocol: string; checkpoint: { registers: Record<string, CrdtRegister> }; checkpoint_sequence: number; version: number }> {
  const result = await pool.query<{
    id: string;
    protocol: string;
    checkpoint: { registers: Record<string, CrdtRegister> };
    checkpoint_sequence: string | number;
    version: number;
  }>(
    `insert into "collaboration_rooms" ("workspace_id", "node_id")
     values ($1, $2)
     on conflict ("workspace_id", "node_id")
     do update set "updated_at" = "collaboration_rooms"."updated_at"
     returning "id", "protocol", "checkpoint", "checkpoint_sequence", "version"`,
    [workspaceId, nodeId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("COLLABORATION_ROOM_UNAVAILABLE");
  return {
    ...row,
    checkpoint_sequence: Number(row.checkpoint_sequence),
  };
}

export async function getCollaborationRoomState(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
): Promise<CollaborationRoomState> {
  const room = await ensureRoom(pool, workspaceId, nodeId);
  const updates = await pool.query<{
    id: string;
    sequence: string | number;
    client_id: string;
    client_clock: string | number;
    update: { registers?: CrdtRegister[] };
    created_at: Date;
  }>(
    `select "id", "sequence", "client_id", "client_clock", "update", "created_at"
     from "collaboration_updates"
     where "room_id" = $1 and "sequence" > $2
     order by "sequence"`,
    [room.id, room.checkpoint_sequence],
  );
  return {
    roomId: room.id,
    workspaceId,
    nodeId,
    protocol: room.protocol,
    checkpoint: room.checkpoint ?? { registers: {} },
    checkpointSequence: room.checkpoint_sequence,
    version: room.version,
    updates: updates.rows.map((row) => ({
      id: row.id,
      sequence: Number(row.sequence),
      clientId: row.client_id,
      clientClock: Number(row.client_clock),
      registers: row.update.registers ?? [],
      createdAt: row.created_at,
    })),
  };
}

export async function appendCollaborationUpdate(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    clientId: string;
    clientClock: number;
    registers: CrdtRegister[];
    actorUserId: string;
  },
): Promise<{ update: CollaborationUpdateRecord; duplicate: boolean }> {
  if (input.registers.length === 0 || input.registers.length > 1000) {
    throw new Error("INVALID_CRDT_UPDATE");
  }
  const encoded = JSON.stringify({
    clientId: input.clientId,
    clock: input.clientClock,
    registers: input.registers,
  });
  if (Buffer.byteLength(encoded, "utf8") > 256 * 1024) {
    throw new Error("CRDT_UPDATE_TOO_LARGE");
  }
  const hash = createHash("sha256").update(encoded).digest("hex");

  return withWorkspaceTransaction(pool, async (client) => {
    const room = await client.query<{
      id: string;
      checkpoint: { registers: Record<string, CrdtRegister> };
      checkpoint_sequence: string | number;
    }>(
      `insert into "collaboration_rooms" ("workspace_id", "node_id")
       values ($1, $2)
       on conflict ("workspace_id", "node_id")
       do update set "updated_at" = now()
       returning "id", "checkpoint", "checkpoint_sequence"`,
      [input.workspaceId, input.nodeId],
    );
    const roomRow = room.rows[0];
    if (!roomRow) throw new Error("COLLABORATION_ROOM_UNAVAILABLE");

    const existing = await client.query<{
      id: string;
      sequence: string | number;
      client_id: string;
      client_clock: string | number;
      update: { registers?: CrdtRegister[] };
      update_hash: string;
      created_at: Date;
    }>(
      `select "id", "sequence", "client_id", "client_clock", "update",
              "update_hash", "created_at"
       from "collaboration_updates"
       where "room_id" = $1 and "client_id" = $2 and "client_clock" = $3
       for update`,
      [roomRow.id, input.clientId, input.clientClock],
    );
    const replay = existing.rows[0];
    if (replay) {
      if (replay.update_hash !== hash) throw new Error("CRDT_CLOCK_CONFLICT");
      return {
        duplicate: true,
        update: {
          id: replay.id,
          sequence: Number(replay.sequence),
          clientId: replay.client_id,
          clientClock: Number(replay.client_clock),
          registers: replay.update.registers ?? [],
          createdAt: replay.created_at,
        },
      };
    }

    const inserted = await client.query<{
      id: string;
      sequence: string | number;
      client_id: string;
      client_clock: string | number;
      update: { registers?: CrdtRegister[] };
      created_at: Date;
    }>(
      `insert into "collaboration_updates"
         ("room_id", "client_id", "client_clock", "update", "update_hash")
       values ($1, $2, $3, $4::jsonb, $5)
       returning "id", "sequence", "client_id", "client_clock", "update", "created_at"`,
      [
        roomRow.id,
        input.clientId,
        input.clientClock,
        JSON.stringify({ registers: input.registers }),
        hash,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("CRDT_UPDATE_PERSIST_FAILED");

    await materializeSpatialRegisters(client, {
      workspaceId: input.workspaceId,
      nodeId: input.nodeId,
      actorUserId: input.actorUserId,
      registers: input.registers,
    });

    await client.query(
      `update "collaboration_rooms"
       set "version" = "version" + 1, "updated_at" = now()
       where "id" = $1`,
      [roomRow.id],
    );
    await client.query(
      `insert into "collaboration_room_members" ("room_id", "user_id", "last_client_id")
       values ($1, $2, $3)
       on conflict ("room_id", "user_id")
       do update set "last_seen_at" = now(), "last_client_id" = excluded."last_client_id"`,
      [roomRow.id, input.actorUserId, input.clientId],
    );

    const sinceCheckpoint = await client.query<{
      count: string;
      max_sequence: string | number | null;
    }>(
      `select count(*)::text as "count", max("sequence") as "max_sequence"
       from "collaboration_updates"
       where "room_id" = $1 and "sequence" > $2`,
      [roomRow.id, Number(roomRow.checkpoint_sequence)],
    );
    if (Number(sinceCheckpoint.rows[0]?.count ?? 0) >= 100) {
      const pending = await client.query<{
        id: string;
        sequence: string | number;
        client_id: string;
        client_clock: string | number;
        update: { registers?: CrdtRegister[] };
        created_at: Date;
      }>(
        `select "id", "sequence", "client_id", "client_clock", "update", "created_at"
         from "collaboration_updates"
         where "room_id" = $1 and "sequence" > $2
         order by "sequence"`,
        [roomRow.id, Number(roomRow.checkpoint_sequence)],
      );
      const mapped = pending.rows.map((item) => ({
        id: item.id,
        sequence: Number(item.sequence),
        clientId: item.client_id,
        clientClock: Number(item.client_clock),
        registers: item.update.registers ?? [],
        createdAt: item.created_at,
      }));
      const checkpoint = mergeRegisters(
        roomRow.checkpoint ?? { registers: {} },
        mapped,
      );
      const through = mapped.at(-1)?.sequence ?? Number(roomRow.checkpoint_sequence);
      await client.query(
        `update "collaboration_rooms"
         set "checkpoint" = $2::jsonb, "checkpoint_sequence" = $3,
             "updated_at" = now()
         where "id" = $1`,
        [roomRow.id, JSON.stringify(checkpoint), through],
      );
      await client.query(
        `delete from "collaboration_updates"
         where "room_id" = $1 and "sequence" <= $2`,
        [roomRow.id, through],
      );
    }

    return {
      duplicate: false,
      update: {
        id: row.id,
        sequence: Number(row.sequence),
        clientId: row.client_id,
        clientClock: Number(row.client_clock),
        registers: row.update.registers ?? [],
        createdAt: row.created_at,
      },
    };
  });
}

export async function getRealtimePermissionState(
  pool: Pool,
  input: { workspaceId: string; nodeId: string; userId: string },
): Promise<{
  permissionVersion: number;
  memberActive: boolean;
  nodeActive: boolean;
}> {
  const result = await pool.query<{
    permission_version: number;
    member_active: boolean;
    node_active: boolean;
  }>(
    `select w."permission_version",
            coalesce(m."status" = 'active', false) as "member_active",
            exists(
              select 1 from "content_nodes" n
              where n."workspace_id" = w."id" and n."id" = $2 and n."trashed_at" is null
            ) as "node_active"
     from "workspaces" w
     left join "workspace_members" m
       on m."workspace_id" = w."id" and m."user_id" = $3
     where w."id" = $1
     limit 1`,
    [input.workspaceId, input.nodeId, input.userId],
  );
  const row = result.rows[0];
  return {
    permissionVersion: row?.permission_version ?? -1,
    memberActive: row?.member_active ?? false,
    nodeActive: row?.node_active ?? false,
  };
}

export type CommentRecord = {
  id: string;
  workspaceId: string;
  nodeId: string;
  parentCommentId: string | null;
  body: string;
  anchor: Record<string, unknown>;
  createdByUserId: string;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CommentRow = {
  id: string;
  workspace_id: string;
  node_id: string;
  parent_comment_id: string | null;
  body: string;
  anchor: Record<string, unknown>;
  created_by_user_id: string;
  resolved_at: Date | null;
  resolved_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function toComment(row: CommentRow): CommentRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    anchor: row.anchor ?? {},
    createdByUserId: row.created_by_user_id,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function encodeCursor(row: CommentRecord): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
    "utf8",
  ).toString("base64url");
}

export async function listComments(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    limit?: number | undefined;
    cursor?: string | undefined;
    includeResolved?: boolean | undefined;
  },
): Promise<{ items: CommentRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const cursor = decodeCursor(input.cursor);
  const result = await pool.query<CommentRow>(
    `select "id", "workspace_id", "node_id", "parent_comment_id", "body", "anchor",
            "created_by_user_id", "resolved_at", "resolved_by_user_id",
            "created_at", "updated_at"
     from "collaboration_comments"
     where "workspace_id" = $1 and "node_id" = $2
       and ($3::boolean or "resolved_at" is null)
       and (
         $4::timestamptz is null
         or ("created_at", "id") > ($4::timestamptz, $5::uuid)
       )
     order by "created_at", "id"
     limit $6`,
    [
      input.workspaceId,
      input.nodeId,
      input.includeResolved ?? true,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      limit + 1,
    ],
  );
  const mapped = result.rows.map(toComment);
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
}

export async function createComment(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    parentCommentId?: string | undefined;
    body: string;
    anchor: Record<string, unknown>;
    mentionUserIds: string[];
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<CommentRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    if (input.parentCommentId) {
      const parent = await client.query(
        `select 1 from "collaboration_comments"
         where "workspace_id" = $1 and "node_id" = $2 and "id" = $3
         limit 1`,
        [input.workspaceId, input.nodeId, input.parentCommentId],
      );
      if ((parent.rowCount ?? 0) === 0) throw new Error("COMMENT_PARENT_NOT_FOUND");
    }
    const inserted = await client.query<CommentRow>(
      `insert into "collaboration_comments"
         ("workspace_id", "node_id", "parent_comment_id", "body", "anchor", "created_by_user_id")
       values ($1, $2, $3, $4, $5::jsonb, $6)
       returning "id", "workspace_id", "node_id", "parent_comment_id", "body", "anchor",
                 "created_by_user_id", "resolved_at", "resolved_by_user_id",
                 "created_at", "updated_at"`,
      [
        input.workspaceId,
        input.nodeId,
        input.parentCommentId ?? null,
        input.body,
        JSON.stringify(input.anchor ?? {}),
        input.actorUserId,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("COMMENT_CREATE_FAILED");
    const uniqueMentions = [...new Set(input.mentionUserIds)].filter(
      (userId) => userId !== input.actorUserId,
    );
    for (const userId of uniqueMentions) {
      await client.query(
        `insert into "collaboration_comment_mentions" ("comment_id", "mentioned_user_id")
         select $1, $2
         where exists (
           select 1 from "workspace_members"
           where "workspace_id" = $3 and "user_id" = $2 and "status" = 'active'
         )
         on conflict do nothing`,
        [row.id, userId, input.workspaceId],
      );
    }

    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'comment', $2, 'collaboration.comment_created', $3::jsonb)`,
      [
        input.workspaceId,
        row.id,
        JSON.stringify({
          commentId: row.id,
          nodeId: input.nodeId,
          actorUserId: input.actorUserId,
          mentionedUserIds: uniqueMentions,
          parentCommentId: input.parentCommentId ?? null,
        }),
      ],
    );
    if (uniqueMentions.length > 0) {
      await client.query(
        `insert into "outbox_events"
           ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
         values ($1, 'comment', $2, 'collaboration.mentions_created', $3::jsonb)`,
        [
          input.workspaceId,
          row.id,
          JSON.stringify({
            commentId: row.id,
            nodeId: input.nodeId,
            actorUserId: input.actorUserId,
            mentionedUserIds: uniqueMentions,
          }),
        ],
      );
    }
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "collaboration.comment_created",
      targetType: "comment",
      targetId: row.id,
      requestId: input.requestId,
      metadata: {
        nodeId: input.nodeId,
        parentCommentId: input.parentCommentId ?? null,
        mentionCount: uniqueMentions.length,
      },
    });
    return toComment(row);
  });
}

export async function resolveComment(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    commentId: string;
    actorUserId: string;
    resolved: boolean;
    requestId?: string | undefined;
  },
): Promise<CommentRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query<CommentRow>(
      `update "collaboration_comments"
       set "resolved_at" = case when $5::boolean then now() else null end,
           "resolved_by_user_id" = case when $5::boolean then $4 else null end,
           "updated_at" = now()
       where "workspace_id" = $1 and "node_id" = $2 and "id" = $3
       returning "id", "workspace_id", "node_id", "parent_comment_id", "body", "anchor",
                 "created_by_user_id", "resolved_at", "resolved_by_user_id",
                 "created_at", "updated_at"`,
      [
        input.workspaceId,
        input.nodeId,
        input.commentId,
        input.actorUserId,
        input.resolved,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("COMMENT_NOT_FOUND");
    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'comment', $2, $3, $4::jsonb)`,
      [
        input.workspaceId,
        input.commentId,
        input.resolved ? "collaboration.comment_resolved" : "collaboration.comment_reopened",
        JSON.stringify({
          commentId: input.commentId,
          nodeId: input.nodeId,
          actorUserId: input.actorUserId,
        }),
      ],
    );
    return toComment(row);
  });
}
