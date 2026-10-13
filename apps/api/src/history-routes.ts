import type { AuthVerifier } from "@nexosophy/auth";
import {
  auditListQuerySchema,
  createCheckpointRequestSchema,
  documentVersionParamsSchema,
  permanentDeleteRequestSchema,
  trashListQuerySchema,
} from "@nexosophy/contracts";
import {
  createManualDocumentCheckpoint,
  enqueuePermanentDeletion,
  listDocumentVersions,
  listWorkspaceHistoryAuditEvents,
  listWorkspaceTrash,
  restoreContentSubtree,
  restoreDocumentVersion,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

export async function registerHistoryRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.get("/v1/workspaces/:workspaceId/nodes/:nodeId/versions", async (request, reply) => {
    const { workspaceId, nodeId } = request.params as { workspaceId: string; nodeId: string };
    const query = trashListQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    return listDocumentVersions(pool, {
      workspaceId,
      nodeId,
      limit: query.limit,
      cursor: query.cursor,
    });
  });

  app.post("/v1/workspaces/:workspaceId/nodes/:nodeId/versions", async (request, reply) => {
    const { workspaceId, nodeId } = request.params as { workspaceId: string; nodeId: string };
    const body = createCheckpointRequestSchema.parse(request.body ?? {});
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) {
      return;
    }
    const version = await createManualDocumentCheckpoint(pool, {
      workspaceId,
      nodeId,
      actorUserId: principal.internalUserId,
      label: body.label,
      requestId: request.id,
    });
    reply.code(201);
    return version;
  });

  app.post(
    "/v1/workspaces/:workspaceId/nodes/:nodeId/versions/:versionId/restore",
    async (request, reply) => {
      const { workspaceId, nodeId, versionId } = documentVersionParamsSchema.parse(request.params);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) {
        return;
      }
      return restoreDocumentVersion(pool, {
        workspaceId,
        nodeId,
        versionId,
        actorUserId: principal.internalUserId,
        requestId: request.id,
      });
    },
  );

  app.get("/v1/workspaces/:workspaceId/trash", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = trashListQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    return listWorkspaceTrash(pool, {
      workspaceId,
      limit: query.limit,
      cursor: query.cursor,
    });
  });

  app.post("/v1/workspaces/:workspaceId/trash/:nodeId/restore", async (request, reply) => {
    const { workspaceId, nodeId } = request.params as { workspaceId: string; nodeId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) {
      return;
    }
    return restoreContentSubtree(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      nodeId,
      requestId: request.id,
      idempotencyKey:
        typeof request.headers["idempotency-key"] === "string"
          ? request.headers["idempotency-key"]
          : undefined,
    });
  });

  app.delete("/v1/workspaces/:workspaceId/trash/:nodeId/permanent", async (request, reply) => {
    const { workspaceId, nodeId } = request.params as { workspaceId: string; nodeId: string };
    permanentDeleteRequestSchema.parse(request.body ?? {});
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.delete", request, reply))) {
      return;
    }
    const queued = await enqueuePermanentDeletion(pool, {
      workspaceId,
      nodeId,
      actorUserId: principal.internalUserId,
      reason: "user_request",
      requestId: request.id,
    });
    reply.code(202);
    return { status: "queued", ...queued };
  });

  app.get("/v1/workspaces/:workspaceId/history/audit", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = auditListQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.update", request, reply))) {
      return;
    }
    return listWorkspaceHistoryAuditEvents(pool, {
      workspaceId,
      limit: query.limit,
      cursor: query.cursor,
      action: query.action,
    });
  });

  app.get("/v1/workspaces/:workspaceId/retention", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.read", request, reply))) {
      return;
    }
    const result = await pool.query<{ trash_retention_days: number }>(
      `select "trash_retention_days"
       from "workspace_retention_policies"
       where "workspace_id" = $1`,
      [workspaceId],
    );
    return { trashRetentionDays: result.rows[0]?.trash_retention_days ?? 30 };
  });

  app.put("/v1/workspaces/:workspaceId/retention", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const days = Number((request.body as { trashRetentionDays?: unknown } | null)?.trashRetentionDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return sendWorkspaceError(
        reply,
        request.id,
        400,
        "VALIDATION_ERROR",
        "Trash retention must be between 1 and 3650 days.",
      );
    }
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.update", request, reply))) {
      return;
    }
    await pool.query(
      `insert into "workspace_retention_policies"
         ("workspace_id", "trash_retention_days", "updated_by_user_id")
       values ($1, $2, $3)
       on conflict ("workspace_id")
       do update set "trash_retention_days" = excluded."trash_retention_days",
                     "updated_by_user_id" = excluded."updated_by_user_id",
                     "updated_at" = now()`,
      [workspaceId, days, principal.internalUserId],
    );
    return { trashRetentionDays: days };
  });
}
