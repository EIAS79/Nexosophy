import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  abortAssetUpload,
  appendCollaborationUpdate,
  createComment,
  createContentNode,
  createManualDocumentCheckpoint,
  getCollaborationRoomState,
  getDocument,
  getRealtimePermissionState,
  getUploadSession,
  initiateAssetUpload,
  listComments,
  listDocumentVersions,
  listWorkspaceTrash,
  resolveComment,
  restoreContentSubtree,
  restoreDocumentVersion,
  saveDocument,
  trashContentSubtree,
} from "@nexosophy/db";

const enabled = process.env.RUN_STAGE2_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("Stage 2 workspace content/history/collaboration / PostgreSQL", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  let workspace = "";
  let foreignWorkspace = "";
  let owner = "";
  let foreignOwner = "";
  let documentId = "";
  let foreignDocumentId = "";

  beforeAll(async () => {
    const makeTenant = async () => {
      const user = await pool.query<{ id: string }>(
        `insert into "users" ("status") values ('active') returning "id"`,
      );
      const uid = user.rows[0]!.id;
      const ws = await pool.query<{ id: string }>(
        `insert into "workspaces" ("type","owner_user_id","name","slug")
         values ('team',$1,'Stage2 CI',$2) returning "id"`,
        [uid, "stage2-" + randomUUID().replaceAll("-", "").slice(0, 22)],
      );
      const wid = ws.rows[0]!.id;
      await pool.query(
        `insert into "workspace_members" ("workspace_id","user_id","role","status")
         values ($1,$2,'owner','active')`,
        [wid, uid],
      );
      return { workspaceId: wid, userId: uid };
    };
    const own = await makeTenant();
    const other = await makeTenant();
    workspace = own.workspaceId;
    foreignWorkspace = other.workspaceId;
    owner = own.userId;
    foreignOwner = other.userId;
    const doc = await createContentNode(pool, {
      workspaceId: workspace, actorUserId: owner,
      parentId: null, kind: "document", name: "Stage2 Notes " + randomUUID(),
    });
    documentId = doc.id;
    const foreignDoc = await createContentNode(pool, {
      workspaceId: foreignWorkspace, actorUserId: foreignOwner,
      parentId: null, kind: "document", name: "Other tenant " + randomUUID(),
    });
    foreignDocumentId = foreignDoc.id;
  });

  afterAll(async () => pool.end());

  it("isolates content IDs, persists acknowledged saves, and rejects conflicting saves", async () => {
    await expect(getDocument(pool, { workspaceId: workspace, nodeId: foreignDocumentId }))
      .rejects.toThrow("Content node not found");
    const version1 = await getDocument(pool, { workspaceId: workspace, nodeId: documentId });
    expect(version1.revision).toBe(1);
    const body = {
      type: "doc" as const,
      blocks: [{ id: randomUUID(), type: "paragraph" as const, text: "Stage 2 persisted note" }],
    };
    const saved = await saveDocument(pool, {
      workspaceId: workspace, nodeId: documentId, actorUserId: owner,
      expectedRevision: 1, body, idempotencyKey: "stage2-save-" + randomUUID(),
    });
    expect(saved.revision).toBe(2);
    expect((await getDocument(pool, { workspaceId: workspace, nodeId: documentId })).body)
      .toEqual(body);
    await expect(saveDocument(pool, {
      workspaceId: workspace, nodeId: documentId, actorUserId: owner,
      expectedRevision: 1, body: { type: "doc", blocks: [] },
    })).rejects.toThrow("The document changed");
  });

  it("restores snapshots as a new document revision and scopes versions to tenant", async () => {
    const checkpoint = await createManualDocumentCheckpoint(pool, {
      workspaceId: workspace, nodeId: documentId, actorUserId: owner, label: "Before edit",
    });
    const before = await getDocument(pool, { workspaceId: workspace, nodeId: documentId });
    await saveDocument(pool, {
      workspaceId: workspace, nodeId: documentId, actorUserId: owner,
      expectedRevision: before.revision,
      body: { type: "doc", blocks: [{ id: randomUUID(), type: "paragraph", text: "Modified" }] },
    });
    await expect(restoreDocumentVersion(pool, {
      workspaceId: foreignWorkspace, nodeId: documentId,
      versionId: checkpoint.id, actorUserId: foreignOwner,
    })).rejects.toThrow("DOCUMENT_VERSION_NOT_FOUND");
    const restored = await restoreDocumentVersion(pool, {
      workspaceId: workspace, nodeId: documentId,
      versionId: checkpoint.id, actorUserId: owner,
    });
    expect(restored.revision).toBeGreaterThan(before.revision);
    expect((await getDocument(pool, { workspaceId: workspace, nodeId: documentId })).body)
      .toEqual(before.body);
    const versions = await listDocumentVersions(pool, { workspaceId: workspace, nodeId: documentId });
    expect(versions.items.length).toBeGreaterThan(0);
  });

  it("stores CRDT updates idempotently and refuses reused client clocks with changed content", async () => {
    const input = {
      workspaceId: workspace, nodeId: documentId, actorUserId: owner,
      clientId: "stage2-browser-" + randomUUID(), clientClock: 1,
      registers: [{ key: "body.text", value: "Collaborative note", deleted: false,
        lamport: 1, actor: owner }],
    };
    const first = await appendCollaborationUpdate(pool, input);
    expect(first.duplicate).toBe(false);
    const replay = await appendCollaborationUpdate(pool, input);
    expect(replay.duplicate).toBe(true);
    await expect(appendCollaborationUpdate(pool, {
      ...input, registers: [{ ...input.registers[0]!, value: "Tampered retry" }],
    })).rejects.toThrow("CRDT_CLOCK_CONFLICT");
    const state = await getCollaborationRoomState(pool, workspace, documentId);
    expect(state.updates.some((update) => update.clientId === input.clientId)).toBe(true);
    await expect(getCollaborationRoomState(pool, workspace, foreignDocumentId))
      .rejects.toThrow();
  });

  it("keeps comments and mentions workspace-scoped and supports resolution", async () => {
    const comment = await createComment(pool, {
      workspaceId: workspace, nodeId: documentId, actorUserId: owner,
      body: "Stage 2 review note", anchor: {}, mentionUserIds: [foreignOwner],
    });
    const mentionCount = await pool.query<{ count: string }>(
      `select count(*)::text as count from "collaboration_comment_mentions"
       where "comment_id"=$1`,
      [comment.id],
    );
    expect(Number(mentionCount.rows[0]!.count)).toBe(0);
    const list = await listComments(pool, { workspaceId: workspace, nodeId: documentId });
    expect(list.items.some((row) => row.id === comment.id)).toBe(true);
    const resolved = await resolveComment(pool, {
      workspaceId: workspace, nodeId: documentId, commentId: comment.id,
      actorUserId: owner, resolved: true,
    });
    expect(resolved.resolvedAt).toBeTruthy();
    await expect(resolveComment(pool, {
      workspaceId: foreignWorkspace, nodeId: documentId,
      commentId: comment.id, actorUserId: foreignOwner, resolved: true,
    })).rejects.toThrow();
  });

  it("invalidates realtime permissions on user suspension, trash and workspace archive", async () => {
    const params = { workspaceId: workspace, nodeId: documentId, userId: owner };
    const initial = await getRealtimePermissionState(pool, params);
    expect(initial.memberActive).toBe(true);
    expect(initial.nodeActive).toBe(true);
    expect((await getRealtimePermissionState(pool, { ...params, userId: foreignOwner })).memberActive)
      .toBe(false);
    await pool.query(`update "users" set "status"='suspended' where "id"=$1`, [owner]);
    expect((await getRealtimePermissionState(pool, params)).memberActive).toBe(false);
    await pool.query(`update "users" set "status"='active' where "id"=$1`, [owner]);
    await pool.query(`update "content_nodes" set "trashed_at"=now() where "id"=$1`, [documentId]);
    expect((await getRealtimePermissionState(pool, params)).nodeActive).toBe(false);
    await pool.query(`update "content_nodes" set "trashed_at"=null where "id"=$1`, [documentId]);
    await pool.query(`update "workspaces" set "archived_at"=now() where "id"=$1`, [workspace]);
    expect((await getRealtimePermissionState(pool, params)).memberActive).toBe(false);
    await pool.query(`update "workspaces" set "archived_at"=null where "id"=$1`, [workspace]);
  });

  it("isolates uploads and validates MIME before creating asset/session records", async () => {
    await expect(initiateAssetUpload(pool, {
      workspaceId: workspace, userId: owner, parentId: null,
      filename: "program.exe", mimeType: "application/x-msdownload", sizeBytes: 512,
    })).rejects.toThrow("UPLOAD_MIME_NOT_ALLOWED");
    const upload = await initiateAssetUpload(pool, {
      workspaceId: workspace, userId: owner, parentId: null,
      filename: "illustration.png", mimeType: "image/png", sizeBytes: 2048,
    });
    expect(upload.session.id).toBeTruthy();
    expect(await getUploadSession(pool, foreignWorkspace, upload.session.id)).toBeNull();
    await expect(abortAssetUpload(pool, {
      workspaceId: foreignWorkspace, sessionId: upload.session.id, userId: foreignOwner,
    })).rejects.toThrow();
    const aborted = await abortAssetUpload(pool, {
      workspaceId: workspace, sessionId: upload.session.id, userId: owner,
    });
    expect(aborted.objectKey).toBeTruthy();
  });

  it("trash and restore roundtrip preserves the original node identity", async () => {
    const folder = await createContentNode(pool, {
      workspaceId: workspace, actorUserId: owner, parentId: null,
      kind: "folder", name: "Trash roundtrip " + randomUUID(),
    });
    await trashContentSubtree(pool, { workspaceId: workspace, actorUserId: owner, nodeId: folder.id });
    const trashed = await listWorkspaceTrash(pool, { workspaceId: workspace });
    expect(trashed.items.some((item) => item.id === folder.id)).toBe(true);
    await restoreContentSubtree(pool, { workspaceId: workspace, actorUserId: owner, nodeId: folder.id });
    const after = await listWorkspaceTrash(pool, { workspaceId: workspace });
    expect(after.items.some((item) => item.id === folder.id)).toBe(false);
  });
});
