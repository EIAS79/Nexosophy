import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { assertContentParent } from "./content-store-core.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export type AssetRecord = {
  id: string;
  workspaceId: string;
  nodeId: string | null;
  objectKey: string;
  originalFilename: string;
  declaredMime: string;
  detectedMime: string | null;
  sizeBytes: number;
  checksumSha256: string | null;
  etag: string | null;
  trustState: "pending_upload" | "pending_scan" | "quarantined" | "trusted" | "rejected" | "deleted";
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type UploadSessionRecord = {
  id: string;
  workspaceId: string;
  assetId: string;
  userId: string;
  storageUploadId: string | null;
  status:
    | "initiated"
    | "uploading"
    | "completing"
    | "scanning"
    | "processing"
    | "complete"
    | "aborted"
    | "expired"
    | "failed";
  expectedSizeBytes: number;
  declaredMime: string;
  expectedChecksumSha256: string | null;
  partSizeBytes: number;
  expectedParts: number;
  uploadedBytes: number;
  expiresAt: Date;
};

export type AssetProcessingJob = {
  id: string;
  workspaceId: string;
  assetId: string;
  jobType:
    | "scan"
    | "thumbnail"
    | "image_preview"
    | "pdf_preview"
    | "pdf_text"
    | "office_preview"
    | "media_metadata"
    | "waveform"
    | "video_poster"
    | "cleanup";
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
};

type AssetRow = {
  id: string;
  workspace_id: string;
  node_id: string | null;
  object_key: string;
  original_filename: string;
  declared_mime: string;
  detected_mime: string | null;
  size_bytes: string | number;
  checksum_sha256: string | null;
  etag: string | null;
  trust_state: AssetRecord["trustState"];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type UploadRow = {
  id: string;
  workspace_id: string;
  asset_id: string;
  user_id: string;
  storage_upload_id: string | null;
  status: UploadSessionRecord["status"];
  expected_size_bytes: string | number;
  declared_mime: string;
  expected_checksum_sha256: string | null;
  part_size_bytes: number;
  expected_parts: number;
  uploaded_bytes: string | number;
  expires_at: Date;
};

function toAsset(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    declaredMime: row.declared_mime,
    detectedMime: row.detected_mime,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256,
    etag: row.etag,
    trustState: row.trust_state,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toUpload(row: UploadRow): UploadSessionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    userId: row.user_id,
    storageUploadId: row.storage_upload_id,
    status: row.status,
    expectedSizeBytes: Number(row.expected_size_bytes),
    declaredMime: row.declared_mime,
    expectedChecksumSha256: row.expected_checksum_sha256,
    partSizeBytes: row.part_size_bytes,
    expectedParts: row.expected_parts,
    uploadedBytes: Number(row.uploaded_bytes),
    expiresAt: row.expires_at,
  };
}

const ACTIVE_UPLOADS = ["initiated", "uploading", "completing", "scanning", "processing"] as const;

function allowedUploadMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (
    normalized.startsWith("image/") ||
    normalized.startsWith("audio/") ||
    normalized.startsWith("video/") ||
    normalized.startsWith("text/")
  ) {
    return true;
  }
  return new Set([
    "application/pdf",
    "application/json",
    "application/zip",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
  ]).has(normalized);
}

export async function initiateAssetUpload(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    parentId: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256?: string | undefined;
    requestId?: string | undefined;
  },
): Promise<{ asset: AssetRecord; session: UploadSessionRecord }> {
  if (!allowedUploadMime(input.mimeType)) {
    throw new Error("UPLOAD_MIME_NOT_ALLOWED");
  }

  return withWorkspaceTransaction(pool, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      "uploads:" + input.workspaceId,
    ]);
    await assertContentParent(client, input.workspaceId, input.parentId);

    const limit = await client.query<{ max_bytes: string; max_concurrent_uploads: number }>(
      `select "max_bytes", "max_concurrent_uploads"
       from "workspace_storage_limits"
       where "workspace_id" = $1
       for update`,
      [input.workspaceId],
    );
    const limits = limit.rows[0] ?? { max_bytes: "10737418240", max_concurrent_uploads: 4 };

    if (!limit.rows[0]) {
      await client.query(
        `insert into "workspace_storage_limits" ("workspace_id")
         values ($1)
         on conflict ("workspace_id") do nothing`,
        [input.workspaceId],
      );
    }

    const active = await client.query<{ count: string; reserved: string }>(
      `select count(*)::text as "count",
              coalesce(sum("expected_size_bytes"), 0)::text as "reserved"
       from "upload_sessions"
       where "workspace_id" = $1
         and "status" = any($2::upload_session_status[])
         and "expires_at" > now()`,
      [input.workspaceId, ACTIVE_UPLOADS],
    );
    if (Number(active.rows[0]?.count ?? 0) >= limits.max_concurrent_uploads) {
      throw new Error("UPLOAD_CONCURRENCY_LIMIT");
    }

    const stored = await client.query<{ total: string }>(
      `select coalesce(sum("size_bytes"), 0)::text as "total"
       from "assets"
       where "workspace_id" = $1
         and "trust_state" <> 'deleted'`,
      [input.workspaceId],
    );
    const projected =
      Number(stored.rows[0]?.total ?? 0) +
      Number(active.rows[0]?.reserved ?? 0) +
      input.sizeBytes;
    if (projected > Number(limits.max_bytes)) {
      throw new Error("UPLOAD_QUOTA_EXCEEDED");
    }

    const assetId = randomUUID();
    const nodeId = randomUUID();
    const sessionId = randomUUID();
    const safeName = input.filename.trim().slice(0, 512);
    const partSize = Math.max(8 * 1024 * 1024, Math.ceil(input.sizeBytes / 10_000));
    const normalizedPartSize = Math.min(
      128 * 1024 * 1024,
      Math.ceil(partSize / (1024 * 1024)) * 1024 * 1024,
    );
    const expectedParts = Math.max(1, Math.ceil(input.sizeBytes / normalizedPartSize));
    const objectKey = "workspaces/" + input.workspaceId + "/assets/" + assetId + "/source";

    await client.query(
      `insert into "content_nodes"
         ("id", "workspace_id", "parent_id", "kind", "name", "metadata",
          "created_by_user_id", "updated_by_user_id")
       values ($1, $2, $3, 'attachment', $4, $5::jsonb, $6, $6)`,
      [
        nodeId,
        input.workspaceId,
        input.parentId,
        safeName,
        JSON.stringify({ assetId, uploadStatus: "uploading" }),
        input.userId,
      ],
    );

    const assetResult = await client.query<AssetRow>(
      `insert into "assets"
         ("id", "workspace_id", "node_id", "object_key", "original_filename",
          "declared_mime", "size_bytes", "checksum_sha256",
          "created_by_user_id", "updated_by_user_id")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       returning *`,
      [
        assetId,
        input.workspaceId,
        nodeId,
        objectKey,
        safeName,
        input.mimeType,
        input.sizeBytes,
        input.checksumSha256 ?? null,
        input.userId,
      ],
    );

    const sessionResult = await client.query<UploadRow>(
      `insert into "upload_sessions"
         ("id", "workspace_id", "asset_id", "user_id", "expected_size_bytes",
          "declared_mime", "expected_checksum_sha256", "part_size_bytes",
          "expected_parts", "expires_at")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + interval '24 hours')
       returning *`,
      [
        sessionId,
        input.workspaceId,
        assetId,
        input.userId,
        input.sizeBytes,
        input.mimeType,
        input.checksumSha256 ?? null,
        normalizedPartSize,
        expectedParts,
      ],
    );

    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "asset.upload_initiated",
      targetType: "asset",
      targetId: assetId,
      requestId: input.requestId,
      metadata: { nodeId, sizeBytes: input.sizeBytes, mimeType: input.mimeType },
    });

    const asset = assetResult.rows[0];
    const session = sessionResult.rows[0];
    if (!asset || !session) throw new Error("Upload initialization failed.");
    return { asset: toAsset(asset), session: toUpload(session) };
  });
}

export async function attachMultipartUploadId(
  pool: Pool,
  workspaceId: string,
  sessionId: string,
  storageUploadId: string,
): Promise<void> {
  const result = await pool.query(
    `update "upload_sessions"
     set "storage_upload_id" = $3, "status" = 'uploading', "updated_at" = now()
     where "workspace_id" = $1 and "id" = $2 and "status" = 'initiated'`,
    [workspaceId, sessionId, storageUploadId],
  );
  if ((result.rowCount ?? 0) !== 1) throw new Error("UPLOAD_SESSION_STATE_CONFLICT");
}

export async function getUploadSession(
  pool: Pool,
  workspaceId: string,
  sessionId: string,
): Promise<{ session: UploadSessionRecord; asset: AssetRecord; parts: Array<{ partNumber: number; etag: string; sizeBytes: number; checksumSha256: string | null }> } | null> {
  const result = await pool.query<UploadRow & AssetRow>(
    `select s."id", s."workspace_id", s."asset_id", s."user_id", s."storage_upload_id",
            s."status", s."expected_size_bytes", s."declared_mime",
            s."expected_checksum_sha256", s."part_size_bytes", s."expected_parts",
            s."uploaded_bytes", s."expires_at",
            a."id" as "a_id", a."workspace_id" as "a_workspace_id",
            a."node_id" as "a_node_id", a."object_key" as "a_object_key",
            a."original_filename" as "a_original_filename",
            a."declared_mime" as "a_declared_mime", a."detected_mime" as "a_detected_mime",
            a."size_bytes" as "a_size_bytes", a."checksum_sha256" as "a_checksum_sha256",
            a."etag" as "a_etag", a."trust_state" as "a_trust_state",
            a."metadata" as "a_metadata", a."created_at" as "a_created_at",
            a."updated_at" as "a_updated_at"
     from "upload_sessions" s
     join "assets" a on a."id" = s."asset_id"
     where s."workspace_id" = $1 and s."id" = $2
     limit 1`,
    [workspaceId, sessionId],
  );
  const row = result.rows[0] as any;
  if (!row) return null;
  const parts = await pool.query<{
    part_number: number;
    etag: string;
    size_bytes: number;
    checksum_sha256: string | null;
  }>(
    `select "part_number", "etag", "size_bytes", "checksum_sha256"
     from "upload_parts"
     where "upload_session_id" = $1
     order by "part_number"`,
    [sessionId],
  );
  return {
    session: toUpload(row),
    asset: toAsset({
      id: row.a_id,
      workspace_id: row.a_workspace_id,
      node_id: row.a_node_id,
      object_key: row.a_object_key,
      original_filename: row.a_original_filename,
      declared_mime: row.a_declared_mime,
      detected_mime: row.a_detected_mime,
      size_bytes: row.a_size_bytes,
      checksum_sha256: row.a_checksum_sha256,
      etag: row.a_etag,
      trust_state: row.a_trust_state,
      metadata: row.a_metadata,
      created_at: row.a_created_at,
      updated_at: row.a_updated_at,
    }),
    parts: parts.rows.map((part) => ({
      partNumber: part.part_number,
      etag: part.etag,
      sizeBytes: part.size_bytes,
      checksumSha256: part.checksum_sha256,
    })),
  };
}

export async function recordUploadPart(
  pool: Pool,
  input: {
    workspaceId: string;
    sessionId: string;
    userId: string;
    partNumber: number;
    etag: string;
    sizeBytes: number;
    checksumSha256?: string | undefined;
  },
): Promise<UploadSessionRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const session = await client.query<UploadRow>(
      `select * from "upload_sessions"
       where "workspace_id" = $1 and "id" = $2 and "user_id" = $3
       for update`,
      [input.workspaceId, input.sessionId, input.userId],
    );
    const row = session.rows[0];
    if (!row || !["uploading", "initiated"].includes(row.status)) {
      throw new Error("UPLOAD_SESSION_UNAVAILABLE");
    }
    if (row.expires_at <= new Date()) throw new Error("UPLOAD_SESSION_EXPIRED");
    if (input.partNumber > row.expected_parts) throw new Error("UPLOAD_PART_OUT_OF_RANGE");

    await client.query(
      `insert into "upload_parts"
         ("upload_session_id", "part_number", "etag", "size_bytes", "checksum_sha256")
       values ($1, $2, $3, $4, $5)
       on conflict ("upload_session_id", "part_number")
       do update set "etag" = excluded."etag", "size_bytes" = excluded."size_bytes",
                     "checksum_sha256" = excluded."checksum_sha256"`,
      [
        input.sessionId,
        input.partNumber,
        input.etag,
        input.sizeBytes,
        input.checksumSha256 ?? null,
      ],
    );

    const updated = await client.query<UploadRow>(
      `update "upload_sessions"
       set "status" = 'uploading',
           "uploaded_bytes" = (
             select coalesce(sum("size_bytes"), 0)
             from "upload_parts"
             where "upload_session_id" = $2
           ),
           "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2
       returning *`,
      [input.workspaceId, input.sessionId],
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new Error("UPLOAD_SESSION_UNAVAILABLE");
    return toUpload(updatedRow);
  });
}

export async function beginUploadCompletion(
  pool: Pool,
  input: { workspaceId: string; sessionId: string; userId: string },
): Promise<{
  session: UploadSessionRecord;
  asset: AssetRecord;
  parts: Array<{ partNumber: number; etag: string; sizeBytes: number }>;
}> {
  return withWorkspaceTransaction(pool, async (client) => {
    const state = await getUploadSessionForUpdate(client, input.workspaceId, input.sessionId);
    if (!state || state.session.userId !== input.userId) throw new Error("UPLOAD_SESSION_UNAVAILABLE");
    if (!["uploading", "completing"].includes(state.session.status)) {
      throw new Error("UPLOAD_SESSION_STATE_CONFLICT");
    }
    if (state.parts.length !== state.session.expectedParts) {
      throw new Error("UPLOAD_PARTS_INCOMPLETE");
    }
    const total = state.parts.reduce((sum, part) => sum + part.sizeBytes, 0);
    if (total !== state.session.expectedSizeBytes) throw new Error("UPLOAD_SIZE_MISMATCH");

    await client.query(
      `update "upload_sessions"
       set "status" = 'completing', "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2`,
      [input.workspaceId, input.sessionId],
    );
    state.session.status = "completing";
    return state;
  });
}

async function getUploadSessionForUpdate(
  client: PoolClient,
  workspaceId: string,
  sessionId: string,
): Promise<{
  session: UploadSessionRecord;
  asset: AssetRecord;
  parts: Array<{ partNumber: number; etag: string; sizeBytes: number }>;
} | null> {
  const sessionResult = await client.query<UploadRow>(
    `select * from "upload_sessions"
     where "workspace_id" = $1 and "id" = $2
     for update`,
    [workspaceId, sessionId],
  );
  const sessionRow = sessionResult.rows[0];
  if (!sessionRow) return null;
  const assetResult = await client.query<AssetRow>(
    `select * from "assets" where "workspace_id" = $1 and "id" = $2 for update`,
    [workspaceId, sessionRow.asset_id],
  );
  const assetRow = assetResult.rows[0];
  if (!assetRow) return null;
  const parts = await client.query<{ part_number: number; etag: string; size_bytes: number }>(
    `select "part_number", "etag", "size_bytes"
     from "upload_parts"
     where "upload_session_id" = $1
     order by "part_number"`,
    [sessionId],
  );
  return {
    session: toUpload(sessionRow),
    asset: toAsset(assetRow),
    parts: parts.rows.map((part) => ({
      partNumber: part.part_number,
      etag: part.etag,
      sizeBytes: part.size_bytes,
    })),
  };
}

export async function markUploadVerified(
  pool: Pool,
  input: {
    workspaceId: string;
    sessionId: string;
    userId: string;
    etag?: string | null | undefined;
    actualSizeBytes: number;
    providerChecksumSha256?: string | null | undefined;
    requestId?: string | undefined;
  },
): Promise<AssetRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const state = await getUploadSessionForUpdate(client, input.workspaceId, input.sessionId);
    if (!state || state.session.userId !== input.userId) throw new Error("UPLOAD_SESSION_UNAVAILABLE");
    if (state.session.status !== "completing") throw new Error("UPLOAD_SESSION_STATE_CONFLICT");
    if (input.actualSizeBytes !== state.session.expectedSizeBytes) throw new Error("UPLOAD_SIZE_MISMATCH");
    if (
      state.session.expectedChecksumSha256 &&
      input.providerChecksumSha256 &&
      state.session.expectedChecksumSha256.toLowerCase() !== input.providerChecksumSha256.toLowerCase()
    ) {
      throw new Error("UPLOAD_CHECKSUM_MISMATCH");
    }

    const assetResult = await client.query<AssetRow>(
      `update "assets"
       set "etag" = $3,
           "trust_state" = 'pending_scan',
           "updated_by_user_id" = $4,
           "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2
       returning *`,
      [
        input.workspaceId,
        state.asset.id,
        input.etag ?? null,
        input.userId,
      ],
    );
    await client.query(
      `update "upload_sessions"
       set "status" = 'scanning', "completed_at" = now(), "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2`,
      [input.workspaceId, input.sessionId],
    );
    await client.query(
      `insert into "asset_scans"
         ("workspace_id", "asset_id", "scanner", "status")
       values ($1, $2, 'remote-policy', 'pending')`,
      [input.workspaceId, state.asset.id],
    );
    await client.query(
      `insert into "asset_processing_jobs"
         ("workspace_id", "asset_id", "job_type")
       values ($1, $2, 'scan')
       on conflict ("asset_id", "job_type") do nothing`,
      [input.workspaceId, state.asset.id],
    );
    await client.query(
      `update "content_nodes"
       set "metadata" = "metadata" || $3::jsonb,
           "updated_at" = now(),
           "version" = "version" + 1
       where "workspace_id" = $1 and "id" = $2`,
      [input.workspaceId, state.asset.nodeId, JSON.stringify({ uploadStatus: "scanning" })],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "asset.upload_completed",
      targetType: "asset",
      targetId: state.asset.id,
      requestId: input.requestId,
      metadata: { sizeBytes: input.actualSizeBytes },
    });
    const assetRow = assetResult.rows[0];
    if (!assetRow) throw new Error("Asset verification state was not persisted.");
    return toAsset(assetRow);
  });
}

export async function abortAssetUpload(
  pool: Pool,
  input: { workspaceId: string; sessionId: string; userId: string; requestId?: string | undefined },
): Promise<{ objectKey: string; storageUploadId: string | null }> {
  return withWorkspaceTransaction(pool, async (client) => {
    const state = await getUploadSessionForUpdate(client, input.workspaceId, input.sessionId);
    if (!state || state.session.userId !== input.userId) throw new Error("UPLOAD_SESSION_UNAVAILABLE");
    await client.query(
      `update "upload_sessions"
       set "status" = 'aborted', "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2`,
      [input.workspaceId, input.sessionId],
    );
    await client.query(
      `update "assets"
       set "trust_state" = 'deleted', "deleted_at" = now(), "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2`,
      [input.workspaceId, state.asset.id],
    );
    if (state.asset.nodeId) {
      await client.query(
        `update "content_nodes"
         set "trashed_at" = coalesce("trashed_at", now()),
             "trashed_by_user_id" = $3,
             "updated_at" = now(),
             "version" = "version" + 1
         where "workspace_id" = $1 and "id" = $2`,
        [input.workspaceId, state.asset.nodeId, input.userId],
      );
    }
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "asset.upload_aborted",
      targetType: "asset",
      targetId: state.asset.id,
      requestId: input.requestId,
    });
    return {
      objectKey: state.asset.objectKey,
      storageUploadId: state.session.storageUploadId,
    };
  });
}

export async function getAsset(
  pool: Pool,
  workspaceId: string,
  assetId: string,
): Promise<AssetRecord | null> {
  const result = await pool.query<AssetRow>(
    `select * from "assets"
     where "workspace_id" = $1 and "id" = $2 and "trust_state" <> 'deleted'
     limit 1`,
    [workspaceId, assetId],
  );
  return result.rows[0] ? toAsset(result.rows[0]) : null;
}

export async function listAssetVariants(
  pool: Pool,
  workspaceId: string,
  assetId: string,
): Promise<Array<{
  id: string;
  kind: string;
  status: string;
  objectKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fidelityLabel: string | null;
  metadata: Record<string, unknown>;
}>> {
  const result = await pool.query<{
    id: string;
    kind: string;
    status: string;
    object_key: string | null;
    mime_type: string | null;
    size_bytes: string | number | null;
    fidelity_label: string | null;
    metadata: Record<string, unknown>;
  }>(
    `select "id", "kind", "status", "object_key", "mime_type", "size_bytes",
            "fidelity_label", "metadata"
     from "asset_variants"
     where "workspace_id" = $1 and "asset_id" = $2
     order by "kind"`,
    [workspaceId, assetId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    objectKey: row.object_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    fidelityLabel: row.fidelity_label,
    metadata: row.metadata ?? {},
  }));
}

export async function claimNextAssetJob(
  pool: Pool,
  workerId: string,
): Promise<AssetProcessingJob | null> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "asset_processing_jobs"
       set "status" = 'queued', "locked_at" = null, "locked_by" = null, "updated_at" = now()
       where "status" = 'running'
         and "locked_at" < now() - interval '10 minutes'
         and "attempts" < "max_attempts"`,
    );
    const selected = await client.query<{ id: string }>(
      `select "id" from "asset_processing_jobs"
       where "status" = 'queued'
         and "run_after" <= now()
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
      asset_id: string;
      job_type: AssetProcessingJob["jobType"];
      payload: Record<string, unknown>;
      attempts: number;
      max_attempts: number;
    }>(
      `update "asset_processing_jobs"
       set "status" = 'running', "attempts" = "attempts" + 1,
           "locked_at" = now(), "locked_by" = $2, "updated_at" = now()
       where "id" = $1
       returning "id", "workspace_id", "asset_id", "job_type", "payload",
                 "attempts", "max_attempts"`,
      [id, workerId],
    );
    const row = updated.rows[0];
    return row
      ? {
          id: row.id,
          workspaceId: row.workspace_id,
          assetId: row.asset_id,
          jobType: row.job_type,
          payload: row.payload ?? {},
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
        }
      : null;
  });
}

function derivativeKinds(mime: string): AssetProcessingJob["jobType"][] {
  if (mime.startsWith("image/")) return ["thumbnail", "image_preview", "media_metadata"];
  if (mime === "application/pdf") return ["thumbnail", "pdf_preview", "pdf_text"];
  if (
    mime.includes("officedocument") ||
    mime === "application/msword" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.ms-powerpoint"
  ) {
    return ["office_preview"];
  }
  if (mime.startsWith("audio/")) return ["media_metadata", "waveform"];
  if (mime.startsWith("video/")) return ["media_metadata", "waveform", "video_poster"];
  return ["media_metadata"];
}

export async function completeAssetScan(
  pool: Pool,
  input: {
    jobId: string;
    workspaceId: string;
    assetId: string;
    clean: boolean;
    detectedMime: string;
    scanner: string;
    scannerVersion?: string | undefined;
    resultCode?: string | undefined;
    checksumSha256?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const scan = await client.query<{ id: string }>(
      `select "id" from "asset_scans"
       where "workspace_id" = $1 and "asset_id" = $2 and "status" = 'pending'
       order by "created_at" desc
       limit 1
       for update`,
      [input.workspaceId, input.assetId],
    );
    const scanId = scan.rows[0]?.id;
    if (!scanId) throw new Error("ASSET_SCAN_NOT_FOUND");

    const currentAsset = await client.query<{
      checksum_sha256: string | null;
    }>(
      `select "checksum_sha256"
       from "assets"
       where "workspace_id" = $1 and "id" = $2
       for update`,
      [input.workspaceId, input.assetId],
    );
    const expectedChecksum = currentAsset.rows[0]?.checksum_sha256?.toLowerCase() ?? null;
    const scannedChecksum = input.checksumSha256?.toLowerCase() ?? null;
    const checksumValid = expectedChecksum
      ? scannedChecksum !== null && scannedChecksum === expectedChecksum
      : true;
    const detectedMimeAllowed = allowedUploadMime(input.detectedMime);
    const effectiveClean = input.clean && checksumValid && detectedMimeAllowed;
    const trustedState = effectiveClean ? "trusted" : "quarantined";
    const policyResultCode = !input.clean
      ? (input.resultCode ?? "malware_or_policy_rejected")
      : !detectedMimeAllowed
        ? "detected_mime_not_allowed"
        : !checksumValid
          ? scannedChecksum
            ? "checksum_mismatch"
            : "checksum_missing"
          : (input.resultCode ?? "clean");

    await client.query(
      `update "asset_scans"
       set "scanner" = $3, "scanner_version" = $4,
           "status" = $5::asset_scan_status, "result_code" = $6,
           "metadata" = $7::jsonb, "started_at" = coalesce("started_at", now()),
           "completed_at" = now()
       where "workspace_id" = $1 and "id" = $2`,
      [
        input.workspaceId,
        scanId,
        input.scanner,
        input.scannerVersion ?? null,
        effectiveClean ? "clean" : "infected",
        policyResultCode,
        JSON.stringify({
          ...(input.metadata ?? {}),
          checksumSha256: scannedChecksum,
          checksumVerified: checksumValid,
          detectedMimeAllowed,
        }),
      ],
    );
    const asset = await client.query<{ node_id: string | null }>(
      `update "assets"
       set "detected_mime" = $3,
           "checksum_sha256" = coalesce("checksum_sha256", $5),
           "trust_state" = $4::asset_trust_state,
           "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2
       returning "node_id"`,
      [input.workspaceId, input.assetId, input.detectedMime, trustedState, scannedChecksum],
    );
    await client.query(
      `update "asset_processing_jobs"
       set "status" = 'succeeded', "locked_at" = null, "locked_by" = null,
           "last_error" = null, "updated_at" = now()
       where "id" = $1`,
      [input.jobId],
    );

    if (effectiveClean) {
      const kinds = derivativeKinds(input.detectedMime);
      for (const kind of kinds) {
        await client.query(
          `insert into "asset_processing_jobs" ("workspace_id", "asset_id", "job_type")
           values ($1, $2, $3::asset_job_type)
           on conflict ("asset_id", "job_type") do nothing`,
          [input.workspaceId, input.assetId, kind],
        );
        const variantKind =
          kind === "thumbnail" ||
          kind === "image_preview" ||
          kind === "pdf_preview" ||
          kind === "pdf_text" ||
          kind === "office_preview" ||
          kind === "media_metadata" ||
          kind === "waveform" ||
          kind === "video_poster"
            ? kind
            : null;
        if (variantKind) {
          await client.query(
            `insert into "asset_variants"
               ("workspace_id", "asset_id", "kind", "status")
             values ($1, $2, $3::asset_variant_kind, 'queued')
             on conflict ("asset_id", "kind") do nothing`,
            [input.workspaceId, input.assetId, variantKind],
          );
        }
      }
    }

    const nodeId = asset.rows[0]?.node_id;
    if (nodeId) {
      await client.query(
        `update "content_nodes"
         set "metadata" = "metadata" || $3::jsonb,
             "updated_at" = now(),
             "version" = "version" + 1
         where "workspace_id" = $1 and "id" = $2`,
        [
          input.workspaceId,
          nodeId,
          JSON.stringify({
            uploadStatus: effectiveClean ? "available" : "quarantined",
            assetTrustState: trustedState,
          }),
        ],
      );
    }
    await client.query(
      `update "upload_sessions"
       set "status" = $3::upload_session_status, "updated_at" = now()
       where "workspace_id" = $1 and "asset_id" = $2`,
      [input.workspaceId, input.assetId, effectiveClean ? "processing" : "failed"],
    );
  });
}

export async function completeAssetVariant(
  pool: Pool,
  input: {
    jobId: string;
    workspaceId: string;
    assetId: string;
    kind: Exclude<AssetProcessingJob["jobType"], "scan" | "cleanup">;
    objectKey: string;
    mimeType?: string | null | undefined;
    sizeBytes?: number | null | undefined;
    checksumSha256?: string | null | undefined;
    fidelityLabel?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "asset_variants"
       set "status" = 'ready', "object_key" = $4, "mime_type" = $5,
           "size_bytes" = $6, "checksum_sha256" = $7, "fidelity_label" = $8,
           "metadata" = $9::jsonb, "error_message" = null, "updated_at" = now()
       where "workspace_id" = $1 and "asset_id" = $2 and "kind" = $3::asset_variant_kind`,
      [
        input.workspaceId,
        input.assetId,
        input.kind,
        input.objectKey,
        input.mimeType ?? null,
        input.sizeBytes ?? null,
        input.checksumSha256 ?? null,
        input.fidelityLabel ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    await client.query(
      `update "asset_processing_jobs"
       set "status" = 'succeeded', "locked_at" = null, "locked_by" = null,
           "last_error" = null, "updated_at" = now()
       where "id" = $1`,
      [input.jobId],
    );
    const remaining = await client.query<{ count: string }>(
      `select count(*)::text as "count"
       from "asset_processing_jobs"
       where "asset_id" = $1
         and "job_type" <> 'scan'
         and "status" in ('queued','running')`,
      [input.assetId],
    );
    if (Number(remaining.rows[0]?.count ?? 0) === 0) {
      await client.query(
        `update "upload_sessions"
         set "status" = 'complete', "updated_at" = now()
         where "workspace_id" = $1 and "asset_id" = $2 and "status" = 'processing'`,
        [input.workspaceId, input.assetId],
      );
    }
  });
}

export async function failAssetJob(
  pool: Pool,
  jobId: string,
  error: Error,
  retryable: boolean,
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const current = await client.query<{
      workspace_id: string;
      asset_id: string;
      job_type: AssetProcessingJob["jobType"];
      attempts: number;
      max_attempts: number;
    }>(
      `select "workspace_id", "asset_id", "job_type", "attempts", "max_attempts"
       from "asset_processing_jobs"
       where "id" = $1
       for update`,
      [jobId],
    );
    const job = current.rows[0];
    if (!job) return;

    const willRetry = retryable && job.attempts < job.max_attempts;
    await client.query(
      `update "asset_processing_jobs"
       set "status" = case
             when $2::boolean then 'queued'::asset_job_status
             else 'failed'::asset_job_status
           end,
           "run_after" = case
             when $2::boolean then now() + make_interval(secs => least(300, 5 * power(2, "attempts")::int))
             else "run_after"
           end,
           "last_error" = left($3, 1000),
           "locked_at" = null,
           "locked_by" = null,
           "updated_at" = now()
       where "id" = $1`,
      [jobId, willRetry, error.message],
    );

    if (willRetry) return;

    if (job.job_type === "scan") {
      await client.query(
        `update "asset_scans"
         set "status" = 'error', "result_code" = 'scanner_failure',
             "completed_at" = now(),
             "metadata" = "metadata" || $3::jsonb
         where "workspace_id" = $1 and "asset_id" = $2 and "status" = 'pending'`,
        [
          job.workspace_id,
          job.asset_id,
          JSON.stringify({ error: error.message.slice(0, 500) }),
        ],
      );
      const asset = await client.query<{ node_id: string | null }>(
        `update "assets"
         set "trust_state" = 'quarantined', "updated_at" = now()
         where "workspace_id" = $1 and "id" = $2
         returning "node_id"`,
        [job.workspace_id, job.asset_id],
      );
      await client.query(
        `update "upload_sessions"
         set "status" = 'failed', "last_error" = left($3, 1000), "updated_at" = now()
         where "workspace_id" = $1 and "asset_id" = $2`,
        [job.workspace_id, job.asset_id, error.message],
      );
      const nodeId = asset.rows[0]?.node_id;
      if (nodeId) {
        await client.query(
          `update "content_nodes"
           set "metadata" = "metadata" || $3::jsonb,
               "updated_at" = now(), "version" = "version" + 1
           where "workspace_id" = $1 and "id" = $2`,
          [
            job.workspace_id,
            nodeId,
            JSON.stringify({
              uploadStatus: "quarantined",
              assetTrustState: "quarantined",
            }),
          ],
        );
      }
      return;
    }

    if (job.job_type !== "cleanup") {
      await client.query(
        `update "asset_variants"
         set "status" = 'failed', "error_message" = left($4, 1000), "updated_at" = now()
         where "workspace_id" = $1 and "asset_id" = $2
           and "kind" = $3::asset_variant_kind`,
        [job.workspace_id, job.asset_id, job.job_type, error.message],
      );
      const remaining = await client.query<{ count: string }>(
        `select count(*)::text as "count"
         from "asset_processing_jobs"
         where "asset_id" = $1 and "job_type" <> 'scan'
           and "status" in ('queued','running')`,
        [job.asset_id],
      );
      if (Number(remaining.rows[0]?.count ?? 0) === 0) {
        await client.query(
          `update "upload_sessions"
           set "status" = 'complete', "updated_at" = now()
           where "workspace_id" = $1 and "asset_id" = $2
             and "status" = 'processing'`,
          [job.workspace_id, job.asset_id],
        );
      }
    }
  });
}

export async function listExpiredMultipartUploads(
  pool: Pool,
  limit = 100,
): Promise<Array<{ sessionId: string; workspaceId: string; objectKey: string; storageUploadId: string }>> {
  const result = await pool.query<{
    session_id: string;
    workspace_id: string;
    object_key: string;
    storage_upload_id: string;
  }>(
    `select s."id" as "session_id", s."workspace_id", a."object_key", s."storage_upload_id"
     from "upload_sessions" s
     join "assets" a on a."id" = s."asset_id"
     where s."expires_at" <= now()
       and s."storage_upload_id" is not null
       and s."status" in ('initiated','uploading','completing')
     order by s."expires_at"
     limit $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    objectKey: row.object_key,
    storageUploadId: row.storage_upload_id,
  }));
}

export async function markExpiredUpload(
  pool: Pool,
  workspaceId: string,
  sessionId: string,
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const updated = await client.query<{ asset_id: string }>(
      `update "upload_sessions"
       set "status" = 'expired', "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2
         and "status" in ('initiated','uploading','completing')
       returning "asset_id"`,
      [workspaceId, sessionId],
    );
    const assetId = updated.rows[0]?.asset_id;
    if (assetId) {
      await client.query(
        `update "assets"
         set "trust_state" = 'deleted', "deleted_at" = now(), "updated_at" = now()
         where "workspace_id" = $1 and "id" = $2`,
        [workspaceId, assetId],
      );
    }
  });
}


export async function requestAssetDeletion(
  pool: Pool,
  input: {
    workspaceId: string;
    assetId: string;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const asset = await client.query<{ node_id: string | null }>(
      `update "assets"
       set "trust_state" = 'deleted', "deleted_at" = coalesce("deleted_at", now()),
           "updated_by_user_id" = $3, "updated_at" = now()
       where "workspace_id" = $1 and "id" = $2 and "trust_state" <> 'deleted'
       returning "node_id"`,
      [input.workspaceId, input.assetId, input.actorUserId],
    );
    if (!asset.rows[0]) return;
    await client.query(
      `insert into "asset_processing_jobs" ("workspace_id", "asset_id", "job_type")
       values ($1, $2, 'cleanup')
       on conflict ("asset_id", "job_type")
       do update set "status" = 'queued', "run_after" = now(), "updated_at" = now()`,
      [input.workspaceId, input.assetId],
    );
    const nodeId = asset.rows[0].node_id;
    if (nodeId) {
      await client.query(
        `update "content_nodes"
         set "trashed_at" = coalesce("trashed_at", now()),
             "trashed_by_user_id" = $3,
             "updated_at" = now(),
             "version" = "version" + 1
         where "workspace_id" = $1 and "id" = $2`,
        [input.workspaceId, nodeId, input.actorUserId],
      );
    }
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "asset.deletion_requested",
      targetType: "asset",
      targetId: input.assetId,
      requestId: input.requestId,
    });
  });
}

export async function getAssetStorageKeys(
  pool: Pool,
  workspaceId: string,
  assetId: string,
): Promise<{ source: string; variants: string[] } | null> {
  const asset = await pool.query<{ object_key: string }>(
    `select "object_key" from "assets"
     where "workspace_id" = $1 and "id" = $2
     limit 1`,
    [workspaceId, assetId],
  );
  const source = asset.rows[0]?.object_key;
  if (!source) return null;
  const variants = await pool.query<{ object_key: string | null }>(
    `select "object_key" from "asset_variants"
     where "workspace_id" = $1 and "asset_id" = $2 and "object_key" is not null`,
    [workspaceId, assetId],
  );
  return {
    source,
    variants: variants.rows.flatMap((row) => (row.object_key ? [row.object_key] : [])),
  };
}

export async function completeAssetCleanup(
  pool: Pool,
  jobId: string,
  workspaceId: string,
  assetId: string,
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `delete from "asset_variants"
       where "workspace_id" = $1 and "asset_id" = $2`,
      [workspaceId, assetId],
    );
    await client.query(
      `update "asset_processing_jobs"
       set "status" = 'succeeded', "locked_at" = null, "locked_by" = null,
           "last_error" = null, "updated_at" = now()
       where "id" = $1`,
      [jobId],
    );
  });
}


export async function getAssetVariantStorageKey(
  pool: Pool,
  workspaceId: string,
  assetId: string,
  kind: string,
): Promise<string | null> {
  const result = await pool.query<{ object_key: string | null }>(
    `select "object_key"
     from "asset_variants"
     where "workspace_id" = $1 and "asset_id" = $2 and "kind" = $3::asset_variant_kind
       and "status" = 'ready'
     limit 1`,
    [workspaceId, assetId, kind],
  );
  return result.rows[0]?.object_key ?? null;
}
