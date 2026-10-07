import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export type RichDocumentBody = {
  type: "doc";
  blocks: Array<{
    id: string;
    type: "paragraph" | "heading" | "bullet" | "quote" | "code";
    text: string;
  }>;
};

export type DocumentRecord = {
  workspaceId: string;
  nodeId: string;
  schemaVersion: number;
  body: RichDocumentBody;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

type DocumentRow = {
  workspace_id: string;
  node_id: string;
  schema_version: number;
  body: RichDocumentBody;
  revision: number;
  created_at: Date;
  updated_at: Date;
};

export class DocumentStoreError extends Error {
  constructor(
    readonly code:
      | "DOCUMENT_NOT_FOUND"
      | "DOCUMENT_NOT_EDITABLE"
      | "DOCUMENT_VERSION_CONFLICT"
      | "DOCUMENT_TOO_LARGE"
      | "IDEMPOTENCY_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "DocumentStoreError";
  }
}

function toDocument(row: DocumentRow): DocumentRecord {
  return {
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    schemaVersion: row.schema_version,
    body: row.body,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EDITABLE_KINDS = new Set([
  "note",
  "document",
  "report",
  "research_item",
  "lab_record",
]);

async function assertEditableNode(
  db: Pool | PoolClient,
  workspaceId: string,
  nodeId: string,
): Promise<void> {
  const result = await db.query<{ kind: string }>(
    `select "kind"::text as "kind"
     from "content_nodes"
     where "workspace_id" = $1 and "id" = $2 and "trashed_at" is null
     limit 1`,
    [workspaceId, nodeId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new DocumentStoreError("DOCUMENT_NOT_FOUND", "Content node not found.");
  }
  if (!EDITABLE_KINDS.has(row.kind)) {
    throw new DocumentStoreError(
      "DOCUMENT_NOT_EDITABLE",
      "This content type does not use the rich document runtime.",
    );
  }
}

async function selectDocument(
  db: Pool | PoolClient,
  workspaceId: string,
  nodeId: string,
): Promise<DocumentRecord | null> {
  const result = await db.query<DocumentRow>(
    `select "workspace_id", "node_id", "schema_version", "body", "revision",
            "created_at", "updated_at"
     from "documents"
     where "workspace_id" = $1 and "node_id" = $2
     limit 1`,
    [workspaceId, nodeId],
  );
  return result.rows[0] ? toDocument(result.rows[0]) : null;
}

export async function getDocument(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
  },
): Promise<DocumentRecord> {
  await assertEditableNode(pool, input.workspaceId, input.nodeId);
  const existing = await selectDocument(pool, input.workspaceId, input.nodeId);
  if (existing) return existing;

  const now = new Date();
  return {
    workspaceId: input.workspaceId,
    nodeId: input.nodeId,
    schemaVersion: 1,
    body: { type: "doc", blocks: [] },
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOrCreateDocument(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
  },
): Promise<DocumentRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    await assertEditableNode(client, input.workspaceId, input.nodeId);
    const existing = await selectDocument(client, input.workspaceId, input.nodeId);
    if (existing) return existing;

    const inserted = await client.query<DocumentRow>(
      `insert into "documents"
         ("workspace_id", "node_id", "body", "created_by_user_id", "updated_by_user_id")
       values ($1, $2, '{"type":"doc","blocks":[]}'::jsonb, $3, $3)
       on conflict ("workspace_id", "node_id") do update
         set "workspace_id" = excluded."workspace_id"
       returning "workspace_id", "node_id", "schema_version", "body", "revision",
                 "created_at", "updated_at"`,
      [input.workspaceId, input.nodeId, input.actorUserId],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("Document initialization did not return a row.");
    return toDocument(row);
  });
}

function requestHash(input: {
  nodeId: string;
  expectedRevision: number;
  body: RichDocumentBody;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        nodeId: input.nodeId,
        expectedRevision: input.expectedRevision,
        body: input.body,
      }),
    )
    .digest("hex");
}

export async function saveDocument(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    actorUserId: string;
    expectedRevision: number;
    body: RichDocumentBody;
    idempotencyKey?: string | undefined;
    requestId?: string | undefined;
  },
): Promise<DocumentRecord> {
  const encoded = JSON.stringify(input.body);
  if (Buffer.byteLength(encoded, "utf8") > 5 * 1024 * 1024) {
    throw new DocumentStoreError(
      "DOCUMENT_TOO_LARGE",
      "The document exceeds the 5 MB canonical body budget.",
    );
  }

  return withWorkspaceTransaction(pool, async (client) => {
    await assertEditableNode(client, input.workspaceId, input.nodeId);
    const hash = requestHash(input);

    if (input.idempotencyKey) {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [
          [
            "api-idempotency",
            input.workspaceId,
            input.actorUserId,
            input.idempotencyKey,
          ].join(":"),
        ],
      );
      await client.query(
        `delete from "api_idempotency_records"
         where "workspace_id" = $1 and "actor_user_id" = $2
           and "idempotency_key" = $3 and "expires_at" <= now()`,
        [input.workspaceId, input.actorUserId, input.idempotencyKey],
      );
      const replay = await client.query<{
        request_hash: string;
        response: DocumentRecord;
      }>(
        `select "request_hash", "response"
         from "api_idempotency_records"
         where "workspace_id" = $1 and "actor_user_id" = $2 and "idempotency_key" = $3
         for update`,
        [input.workspaceId, input.actorUserId, input.idempotencyKey],
      );
      const previous = replay.rows[0];
      if (previous) {
        if (previous.request_hash !== hash) {
          throw new DocumentStoreError(
            "IDEMPOTENCY_CONFLICT",
            "The idempotency key was already used for a different document save.",
          );
        }
        return previous.response;
      }
    }

    let current = await selectDocument(client, input.workspaceId, input.nodeId);
    if (!current) {
      const created = await client.query<DocumentRow>(
        `insert into "documents"
           ("workspace_id", "node_id", "body", "created_by_user_id", "updated_by_user_id")
         values ($1, $2, '{"type":"doc","blocks":[]}'::jsonb, $3, $3)
         returning "workspace_id", "node_id", "schema_version", "body", "revision",
                   "created_at", "updated_at"`,
        [input.workspaceId, input.nodeId, input.actorUserId],
      );
      const row = created.rows[0];
      if (!row) throw new Error("Document initialization failed.");
      current = toDocument(row);
    }

    if (current.revision !== input.expectedRevision) {
      throw new DocumentStoreError(
        "DOCUMENT_VERSION_CONFLICT",
        "The document changed before this save was applied.",
      );
    }

    const updated = await client.query<DocumentRow>(
      `update "documents"
       set "body" = $4::jsonb,
           "revision" = "revision" + 1,
           "updated_by_user_id" = $3,
           "updated_at" = now()
       where "workspace_id" = $1 and "node_id" = $2 and "revision" = $5
       returning "workspace_id", "node_id", "schema_version", "body", "revision",
                 "created_at", "updated_at"`,
      [
        input.workspaceId,
        input.nodeId,
        input.actorUserId,
        encoded,
        input.expectedRevision,
      ],
    );
    const row = updated.rows[0];
    if (!row) {
      throw new DocumentStoreError(
        "DOCUMENT_VERSION_CONFLICT",
        "The document changed before this save was applied.",
      );
    }
    const document = toDocument(row);

    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'document', $2, 'document.saved', $3::jsonb)`,
      [
        input.workspaceId,
        input.nodeId,
        JSON.stringify({
          nodeId: input.nodeId,
          revision: document.revision,
          actorUserId: input.actorUserId,
        }),
      ],
    );

    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "document.saved",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: { revision: document.revision },
    });

    if (input.idempotencyKey) {
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
          JSON.stringify(document),
        ],
      );
    }

    return document;
  });
}
