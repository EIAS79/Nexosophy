import { createHash, randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { createContentNode, getContentNode } from "./content-store-core.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export type SpatialPageMode = "infinite" | "vertical" | "fixed";
export type SpatialBackgroundKind = "plain" | "ruled" | "grid" | "dot";
export type SpatialElementType =
  | "text_region"
  | "ink_stroke"
  | "highlighter_stroke"
  | "shape"
  | "sticky"
  | "connector"
  | "frame"
  | "image"
  | "audio_anchor"
  | "file_attachment"
  | "link_card"
  | "embed"
  | "group";

export type SpatialDocumentRecord = {
  workspaceId: string;
  nodeId: string;
  pageMode: SpatialPageMode;
  backgroundKind: SpatialBackgroundKind;
  paperSize: string;
  orientation: "portrait" | "landscape";
  settings: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SpatialElementRecord = {
  id: string;
  workspaceId: string;
  nodeId: string;
  type: SpatialElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zRank: number;
  groupId: string | null;
  locked: boolean;
  payload: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type SpatialDocumentRow = {
  workspace_id: string;
  node_id: string;
  page_mode: SpatialPageMode;
  background_kind: SpatialBackgroundKind;
  paper_size: string;
  orientation: "portrait" | "landscape";
  settings: Record<string, unknown>;
  version: number;
  created_at: Date;
  updated_at: Date;
};

type SpatialElementRow = {
  id: string;
  workspace_id: string;
  node_id: string;
  type: SpatialElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_rank: string | number;
  group_id: string | null;
  locked: boolean;
  payload: Record<string, unknown>;
  version: number;
  created_at: Date;
  updated_at: Date;
};

function toDocument(row: SpatialDocumentRow): SpatialDocumentRecord {
  return {
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    pageMode: row.page_mode,
    backgroundKind: row.background_kind,
    paperSize: row.paper_size,
    orientation: row.orientation,
    settings: row.settings ?? {},
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toElement(row: SpatialElementRow): SpatialElementRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    type: row.type,
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    rotation: Number(row.rotation),
    zRank: Number(row.z_rank),
    groupId: row.group_id,
    locked: row.locked,
    payload: row.payload ?? {},
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertSpatialNode(
  db: Pool | PoolClient,
  workspaceId: string,
  nodeId: string,
): Promise<"note" | "whiteboard"> {
  const result = await db.query<{ kind: string }>(
    `select "kind"::text as "kind"
     from "content_nodes"
     where "workspace_id" = $1 and "id" = $2 and "trashed_at" is null
     limit 1`,
    [workspaceId, nodeId],
  );
  const kind = result.rows[0]?.kind;
  if (kind !== "note" && kind !== "whiteboard") {
    throw new Error("SPATIAL_NODE_NOT_SUPPORTED");
  }
  return kind;
}

async function ensureSpatialDocumentWithClient(
  client: PoolClient,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    pageMode?: SpatialPageMode | undefined;
  },
): Promise<SpatialDocumentRecord> {
  await assertSpatialNode(client, input.workspaceId, input.nodeId);
  const result = await client.query<SpatialDocumentRow>(
    `insert into "spatial_documents"
       ("workspace_id", "node_id", "page_mode", "created_by_user_id", "updated_by_user_id")
     values ($1, $2, $3::spatial_page_mode, $4, $4)
     on conflict ("workspace_id", "node_id")
     do update set "workspace_id" = excluded."workspace_id"
     returning "workspace_id", "node_id", "page_mode", "background_kind", "paper_size",
               "orientation", "settings", "version", "created_at", "updated_at"`,
    [
      input.workspaceId,
      input.nodeId,
      input.pageMode ?? "infinite",
      input.actorUserId,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("SPATIAL_DOCUMENT_UNAVAILABLE");
  return toDocument(row);
}

export async function getOrCreateSpatialDocument(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    pageMode?: SpatialPageMode | undefined;
  },
): Promise<SpatialDocumentRecord> {
  return withWorkspaceTransaction(pool, (client) =>
    ensureSpatialDocumentWithClient(client, input),
  );
}

export async function getSpatialDocument(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
): Promise<SpatialDocumentRecord | null> {
  const result = await pool.query<SpatialDocumentRow>(
    `select "workspace_id", "node_id", "page_mode", "background_kind", "paper_size",
            "orientation", "settings", "version", "created_at", "updated_at"
     from "spatial_documents"
     where "workspace_id" = $1 and "node_id" = $2
     limit 1`,
    [workspaceId, nodeId],
  );
  return result.rows[0] ? toDocument(result.rows[0]) : null;
}

type ElementCursor = { zRank: number; id: string };

function decodeElementCursor(cursor?: string): ElementCursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as ElementCursor;
    if (!Number.isInteger(value.zRank) || typeof value.id !== "string") return null;
    return value;
  } catch {
    return null;
  }
}

function encodeElementCursor(element: SpatialElementRecord): string {
  return Buffer.from(
    JSON.stringify({ zRank: element.zRank, id: element.id }),
    "utf8",
  ).toString("base64url");
}

export async function listSpatialElements(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    cursor?: string | undefined;
    limit?: number | undefined;
    bounds?: {
      minX?: number | undefined;
      minY?: number | undefined;
      maxX?: number | undefined;
      maxY?: number | undefined;
    } | undefined;
  },
): Promise<{ items: SpatialElementRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
  const cursor = decodeElementCursor(input.cursor);
  const bounds = input.bounds ?? {};
  const result = await pool.query<SpatialElementRow>(
    `select "id", "workspace_id", "node_id", "type", "x", "y", "width", "height",
            "rotation", "z_rank", "group_id", "locked", "payload", "version",
            "created_at", "updated_at"
     from "spatial_elements"
     where "workspace_id" = $1 and "node_id" = $2
       and (
         $3::bigint is null
         or ("z_rank", "id") > ($3::bigint, $4::uuid)
       )
       and ($5::double precision is null or "x" + "width" >= $5)
       and ($6::double precision is null or "y" + "height" >= $6)
       and ($7::double precision is null or "x" <= $7)
       and ($8::double precision is null or "y" <= $8)
     order by "z_rank", "id"
     limit $9`,
    [
      input.workspaceId,
      input.nodeId,
      cursor?.zRank ?? null,
      cursor?.id ?? null,
      bounds.minX ?? null,
      bounds.minY ?? null,
      bounds.maxX ?? null,
      bounds.maxY ?? null,
      limit + 1,
    ],
  );
  const mapped = result.rows.map(toElement);
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeElementCursor(last) : null,
  };
}

export async function getSpatialSnapshot(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    pageMode?: SpatialPageMode | undefined;
  },
): Promise<{
  document: SpatialDocumentRecord;
  elements: SpatialElementRecord[];
}> {
  const document = await getOrCreateSpatialDocument(pool, input);
  const result = await pool.query<SpatialElementRow>(
    `select "id", "workspace_id", "node_id", "type", "x", "y", "width", "height",
            "rotation", "z_rank", "group_id", "locked", "payload", "version",
            "created_at", "updated_at"
     from "spatial_elements"
     where "workspace_id" = $1 and "node_id" = $2
     order by "z_rank", "id"`,
    [input.workspaceId, input.nodeId],
  );
  return { document, elements: result.rows.map(toElement) };
}

export async function updateSpatialDocument(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    expectedVersion: number;
    pageMode?: SpatialPageMode | undefined;
    backgroundKind?: SpatialBackgroundKind | undefined;
    paperSize?: string | undefined;
    orientation?: "portrait" | "landscape" | undefined;
    settings?: Record<string, unknown> | undefined;
    requestId?: string | undefined;
  },
): Promise<SpatialDocumentRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    await ensureSpatialDocumentWithClient(client, input);
    const result = await client.query<SpatialDocumentRow>(
      `update "spatial_documents"
       set "page_mode" = coalesce($4::spatial_page_mode, "page_mode"),
           "background_kind" = coalesce($5::spatial_background_kind, "background_kind"),
           "paper_size" = coalesce($6, "paper_size"),
           "orientation" = coalesce($7, "orientation"),
           "settings" = case when $8::boolean then $9::jsonb else "settings" end,
           "updated_by_user_id" = $3,
           "updated_at" = now(),
           "version" = "version" + 1
       where "workspace_id" = $1 and "node_id" = $2 and "version" = $10
       returning "workspace_id", "node_id", "page_mode", "background_kind", "paper_size",
                 "orientation", "settings", "version", "created_at", "updated_at"`,
      [
        input.workspaceId,
        input.nodeId,
        input.actorUserId,
        input.pageMode ?? null,
        input.backgroundKind ?? null,
        input.paperSize ?? null,
        input.orientation ?? null,
        input.settings !== undefined,
        JSON.stringify(input.settings ?? {}),
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("SPATIAL_VERSION_CONFLICT");
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "spatial.settings_updated",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: {
        pageMode: input.pageMode,
        backgroundKind: input.backgroundKind,
        paperSize: input.paperSize,
        orientation: input.orientation,
      },
    });
    return toDocument(row);
  });
}

export type SpatialElementMutation = {
  id: string;
  type: SpatialElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zRank: number;
  groupId: string | null;
  locked: boolean;
  payload: Record<string, unknown>;
  expectedVersion?: number | undefined;
};

function spatialBatchHash(input: {
  nodeId: string;
  upserts: SpatialElementMutation[];
  deleteIds: string[];
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

async function applySpatialBatchWithClient(
  client: PoolClient,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    upserts: SpatialElementMutation[];
    deleteIds: string[];
  },
): Promise<{ elements: SpatialElementRecord[]; deletedIds: string[] }> {
  await ensureSpatialDocumentWithClient(client, input);

  const returned: SpatialElementRecord[] = [];
  for (const element of input.upserts) {
    const result = await client.query<SpatialElementRow>(
      `insert into "spatial_elements"
         ("id", "workspace_id", "node_id", "type", "x", "y", "width", "height",
          "rotation", "z_rank", "group_id", "locked", "payload",
          "created_by_user_id", "updated_by_user_id")
       values ($1, $2, $3, $4::spatial_element_type, $5, $6, $7, $8, $9, $10, $11,
               $12, $13::jsonb, $14, $14)
       on conflict ("id") do update
       set "type" = excluded."type",
           "x" = excluded."x",
           "y" = excluded."y",
           "width" = excluded."width",
           "height" = excluded."height",
           "rotation" = excluded."rotation",
           "z_rank" = excluded."z_rank",
           "group_id" = excluded."group_id",
           "locked" = excluded."locked",
           "payload" = excluded."payload",
           "updated_by_user_id" = excluded."updated_by_user_id",
           "updated_at" = now(),
           "version" = "spatial_elements"."version" + 1
       where "spatial_elements"."workspace_id" = excluded."workspace_id"
         and "spatial_elements"."node_id" = excluded."node_id"
         and ($15::integer is null or "spatial_elements"."version" = $15)
       returning "id", "workspace_id", "node_id", "type", "x", "y", "width", "height",
                 "rotation", "z_rank", "group_id", "locked", "payload", "version",
                 "created_at", "updated_at"`,
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
        element.expectedVersion ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("SPATIAL_ELEMENT_VERSION_CONFLICT");
    returned.push(toElement(row));
  }

  let deletedIds: string[] = [];
  if (input.deleteIds.length > 0) {
    const deleted = await client.query<{ id: string }>(
      `delete from "spatial_elements"
       where "workspace_id" = $1 and "node_id" = $2 and "id" = any($3::uuid[])
       returning "id"`,
      [input.workspaceId, input.nodeId, input.deleteIds],
    );
    deletedIds = deleted.rows.map((row) => row.id);
  }

  await client.query(
    `update "spatial_documents"
     set "version" = "version" + 1, "updated_by_user_id" = $3, "updated_at" = now()
     where "workspace_id" = $1 and "node_id" = $2`,
    [input.workspaceId, input.nodeId, input.actorUserId],
  );
  return { elements: returned, deletedIds };
}

export async function mutateSpatialElements(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    upserts: SpatialElementMutation[];
    deleteIds: string[];
    idempotencyKey: string;
    requestId?: string | undefined;
  },
): Promise<{ elements: SpatialElementRecord[]; deletedIds: string[] }> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      ["spatial", input.workspaceId, input.nodeId, input.idempotencyKey].join(":"),
    ]);
    const hash = spatialBatchHash(input);
    const replay = await client.query<{ request_hash: string; response: any }>(
      `select "request_hash", "response"
       from "api_idempotency_records"
       where "workspace_id" = $1 and "actor_user_id" = $2 and "idempotency_key" = $3
         and "expires_at" > now()
       for update`,
      [input.workspaceId, input.actorUserId, input.idempotencyKey],
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_hash !== hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return replay.rows[0].response as {
        elements: SpatialElementRecord[];
        deletedIds: string[];
      };
    }

    const result = await applySpatialBatchWithClient(client, input);
    await client.query(
      `insert into "api_idempotency_records"
         ("workspace_id", "actor_user_id", "idempotency_key", "request_hash",
          "response_status", "response")
       values ($1, $2, $3, $4, 200, $5::jsonb)`,
      [
        input.workspaceId,
        input.actorUserId,
        input.idempotencyKey,
        hash,
        JSON.stringify(result),
      ],
    );
    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'spatial_document', $2, 'spatial.elements_changed', $3::jsonb)`,
      [
        input.workspaceId,
        input.nodeId,
        JSON.stringify({
          nodeId: input.nodeId,
          upsertCount: input.upserts.length,
          deleteCount: input.deleteIds.length,
          actorUserId: input.actorUserId,
        }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "spatial.elements_changed",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: {
        upsertCount: input.upserts.length,
        deleteCount: input.deleteIds.length,
      },
    });
    return result;
  });
}

function isSpatialElementValue(value: unknown): value is SpatialElementMutation {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.type === "string" &&
    typeof item.x === "number" &&
    typeof item.y === "number" &&
    typeof item.width === "number" &&
    typeof item.height === "number"
  );
}

export async function materializeSpatialRegisters(
  client: PoolClient,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    registers: Array<{
      key: string;
      value?: unknown;
      deleted: boolean;
    }>;
  },
): Promise<void> {
  const applicable = input.registers.filter(
    (register) =>
      register.key === "canvas:settings" ||
      register.key.startsWith("canvas:element:"),
  );
  if (applicable.length === 0) return;

  const nodeKind = await assertSpatialNode(client, input.workspaceId, input.nodeId);
  await ensureSpatialDocumentWithClient(client, {
    workspaceId: input.workspaceId,
    nodeId: input.nodeId,
    actorUserId: input.actorUserId,
    pageMode: nodeKind === "whiteboard" ? "infinite" : "infinite",
  });

  for (const register of applicable) {
    if (register.key === "canvas:settings") {
      if (register.deleted || !register.value || typeof register.value !== "object") continue;
      const settings = register.value as Record<string, unknown>;
      const pageMode =
        settings.pageMode === "vertical" || settings.pageMode === "fixed"
          ? settings.pageMode
          : "infinite";
      const backgroundKind =
        settings.backgroundKind === "ruled" ||
        settings.backgroundKind === "grid" ||
        settings.backgroundKind === "dot"
          ? settings.backgroundKind
          : "plain";
      const orientation = settings.orientation === "landscape" ? "landscape" : "portrait";
      await client.query(
        `update "spatial_documents"
         set "page_mode" = $3::spatial_page_mode,
             "background_kind" = $4::spatial_background_kind,
             "paper_size" = $5,
             "orientation" = $6,
             "settings" = $7::jsonb,
             "updated_by_user_id" = $8,
             "updated_at" = now(),
             "version" = "version" + 1
         where "workspace_id" = $1 and "node_id" = $2`,
        [
          input.workspaceId,
          input.nodeId,
          pageMode,
          backgroundKind,
          typeof settings.paperSize === "string" ? settings.paperSize.slice(0, 32) : "A4",
          orientation,
          JSON.stringify(settings),
          input.actorUserId,
        ],
      );
      continue;
    }

    const id = register.key.slice("canvas:element:".length);
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    if (register.deleted) {
      await client.query(
        `delete from "spatial_elements"
         where "workspace_id" = $1 and "node_id" = $2 and "id" = $3`,
        [input.workspaceId, input.nodeId, id],
      );
      continue;
    }
    if (!isSpatialElementValue(register.value)) continue;
    const element = register.value;
    await client.query(
      `insert into "spatial_elements"
         ("id", "workspace_id", "node_id", "type", "x", "y", "width", "height",
          "rotation", "z_rank", "group_id", "locked", "payload",
          "created_by_user_id", "updated_by_user_id")
       values ($1, $2, $3, $4::spatial_element_type, $5, $6, $7, $8, $9, $10, $11,
               $12, $13::jsonb, $14, $14)
       on conflict ("id") do update
       set "type" = excluded."type", "x" = excluded."x", "y" = excluded."y",
           "width" = excluded."width", "height" = excluded."height",
           "rotation" = excluded."rotation", "z_rank" = excluded."z_rank",
           "group_id" = excluded."group_id", "locked" = excluded."locked",
           "payload" = excluded."payload",
           "updated_by_user_id" = excluded."updated_by_user_id",
           "updated_at" = now(), "version" = "spatial_elements"."version" + 1
       where "spatial_elements"."workspace_id" = excluded."workspace_id"
         and "spatial_elements"."node_id" = excluded."node_id"`,
      [
        id,
        input.workspaceId,
        input.nodeId,
        element.type,
        element.x,
        element.y,
        Math.max(1, element.width),
        Math.max(1, element.height),
        element.rotation ?? 0,
        element.zRank ?? 0,
        element.groupId ?? null,
        element.locked ?? false,
        JSON.stringify(element.payload ?? {}),
        input.actorUserId,
      ],
    );
  }
}

export async function getSpatialViewport(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    userId: string;
    deviceKey: string;
  },
): Promise<{ originX: number; originY: number; zoom: number }> {
  const result = await pool.query<{
    origin_x: number;
    origin_y: number;
    zoom: number;
  }>(
    `select "origin_x", "origin_y", "zoom"
     from "spatial_viewports"
     where "workspace_id" = $1 and "node_id" = $2 and "user_id" = $3 and "device_key" = $4
     limit 1`,
    [input.workspaceId, input.nodeId, input.userId, input.deviceKey],
  );
  const row = result.rows[0];
  return row
    ? { originX: Number(row.origin_x), originY: Number(row.origin_y), zoom: Number(row.zoom) }
    : { originX: 0, originY: 0, zoom: 1 };
}

export async function saveSpatialViewport(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    userId: string;
    deviceKey: string;
    originX: number;
    originY: number;
    zoom: number;
  },
): Promise<void> {
  await pool.query(
    `insert into "spatial_viewports"
       ("workspace_id", "node_id", "user_id", "device_key", "origin_x", "origin_y", "zoom")
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict ("workspace_id", "node_id", "user_id", "device_key")
     do update set "origin_x" = excluded."origin_x", "origin_y" = excluded."origin_y",
                   "zoom" = excluded."zoom", "updated_at" = now()`,
    [
      input.workspaceId,
      input.nodeId,
      input.userId,
      input.deviceKey,
      input.originX,
      input.originY,
      input.zoom,
    ],
  );
}

export type NoteHierarchyItemRecord = {
  id: string;
  parentId: string | null;
  kind: "notebook" | "folder" | "note";
  name: string;
  role: "notebook" | "section" | "page";
  rank: number;
  color: string | null;
  metadata: Record<string, unknown>;
};

export async function listNoteHierarchy(
  pool: Pool,
  workspaceId: string,
): Promise<NoteHierarchyItemRecord[]> {
  const result = await pool.query<{
    id: string;
    parent_id: string | null;
    kind: "notebook" | "folder" | "note";
    name: string;
    metadata: Record<string, unknown>;
    rank: string | number | null;
    color: string | null;
  }>(
    `select n."id", n."parent_id", n."kind"::text as "kind", n."name", n."metadata",
            o."rank", o."color"
     from "content_nodes" n
     left join "note_node_order" o
       on o."workspace_id" = n."workspace_id" and o."node_id" = n."id"
     where n."workspace_id" = $1 and n."trashed_at" is null
       and (
         n."kind" = 'notebook'
         or (n."kind" = 'folder' and n."metadata" ->> 'noteRole' = 'section')
         or (n."kind" = 'note' and n."metadata" ->> 'noteRole' = 'page')
       )
     order by coalesce(o."rank", 9223372036854775807), lower(n."name"), n."id"`,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    role:
      row.kind === "notebook"
        ? "notebook"
        : row.kind === "folder"
          ? "section"
          : "page",
    rank: Number(row.rank ?? 9223372036854775807),
    color: row.color,
    metadata: row.metadata ?? {},
  }));
}

async function nextNoteRank(
  pool: Pool,
  workspaceId: string,
  parentId: string,
): Promise<number> {
  const result = await pool.query<{ next_rank: string }>(
    `select coalesce(max("rank"), 0)::text as "next_rank"
     from "note_node_order"
     where "workspace_id" = $1 and "parent_node_id" = $2`,
    [workspaceId, parentId],
  );
  return Number(result.rows[0]?.next_rank ?? 0) + 1024;
}

export async function createNoteHierarchyItem(
  pool: Pool,
  input:
    | {
        workspaceId: string;
        actorUserId: string;
        role: "notebook";
        name: string;
        parentId: string | null;
        color?: string | undefined;
        requestId?: string | undefined;
      }
    | {
        workspaceId: string;
        actorUserId: string;
        role: "section";
        name: string;
        parentId: string;
        color?: string | undefined;
        requestId?: string | undefined;
      }
    | {
        workspaceId: string;
        actorUserId: string;
        role: "page";
        name: string;
        parentId: string;
        pageMode: SpatialPageMode;
        color?: string | undefined;
        requestId?: string | undefined;
      },
): Promise<NoteHierarchyItemRecord> {
  if (input.role === "section") {
    const parent = await getContentNode(pool, input.workspaceId, input.parentId);
    if (!parent || parent.kind !== "notebook") throw new Error("NOTEBOOK_NOT_FOUND");
  }
  if (input.role === "page") {
    const parent = await getContentNode(pool, input.workspaceId, input.parentId);
    if (
      !parent ||
      parent.kind !== "folder" ||
      parent.metadata.noteRole !== "section"
    ) {
      throw new Error("NOTE_SECTION_NOT_FOUND");
    }
  }

  const node = await createContentNode(pool, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    parentId: input.parentId,
    kind:
      input.role === "notebook"
        ? "notebook"
        : input.role === "section"
          ? "folder"
          : "note",
    name: input.name,
    metadata:
      input.role === "notebook"
        ? { noteRole: "notebook" }
        : input.role === "section"
          ? { noteRole: "section" }
          : { noteRole: "page", pageMode: input.pageMode },
    requestId: input.requestId,
  });

  if (input.role === "notebook") {
    return {
      id: node.id,
      parentId: node.parentId,
      kind: "notebook",
      name: node.name,
      role: "notebook",
      rank: 0,
      color: input.color ?? null,
      metadata: node.metadata,
    };
  }

  const rank = await nextNoteRank(pool, input.workspaceId, input.parentId);
  await pool.query(
    `insert into "note_node_order"
       ("workspace_id", "parent_node_id", "node_id", "rank", "color")
     values ($1, $2, $3, $4, $5)`,
    [input.workspaceId, input.parentId, node.id, rank, input.color ?? null],
  );

  if (input.role === "page") {
    await getOrCreateSpatialDocument(pool, {
      workspaceId: input.workspaceId,
      nodeId: node.id,
      actorUserId: input.actorUserId,
      pageMode: input.pageMode,
    });
  }

  return {
    id: node.id,
    parentId: node.parentId,
    kind: input.role === "section" ? "folder" : "note",
    name: node.name,
    role: input.role,
    rank,
    color: input.color ?? null,
    metadata: node.metadata,
  };
}

export async function reorderNoteHierarchy(
  pool: Pool,
  input: {
    workspaceId: string;
    parentId: string;
    orderedNodeIds: string[];
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const expected = await client.query<{ id: string }>(
      `select n."id"
       from "content_nodes" n
       where n."workspace_id" = $1 and n."parent_id" = $2 and n."trashed_at" is null
         and (
           (n."kind" = 'folder' and n."metadata" ->> 'noteRole' = 'section')
           or (n."kind" = 'note' and n."metadata" ->> 'noteRole' = 'page')
         )`,
      [input.workspaceId, input.parentId],
    );
    const expectedIds = new Set(expected.rows.map((row) => row.id));
    if (
      expectedIds.size !== input.orderedNodeIds.length ||
      input.orderedNodeIds.some((id) => !expectedIds.has(id))
    ) {
      throw new Error("NOTE_ORDER_SET_MISMATCH");
    }
    for (const [index, nodeId] of input.orderedNodeIds.entries()) {
      await client.query(
        `insert into "note_node_order"
           ("workspace_id", "parent_node_id", "node_id", "rank")
         values ($1, $2, $3, $4)
         on conflict ("workspace_id", "node_id")
         do update set "parent_node_id" = excluded."parent_node_id",
                       "rank" = excluded."rank", "updated_at" = now()`,
        [input.workspaceId, input.parentId, nodeId, (index + 1) * 1024],
      );
    }
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "notes.order_updated",
      targetType: "node",
      targetId: input.parentId,
      requestId: input.requestId,
      metadata: { count: input.orderedNodeIds.length },
    });
  });
}
