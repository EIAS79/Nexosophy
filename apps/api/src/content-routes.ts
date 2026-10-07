import type { AuthVerifier } from "@nexosophy/auth";
import {
  bulkContentNodeRequestSchema,
  contentFavoriteRequestSchema,
  contentNodeParamsSchema,
  contentOperationParamsSchema,
  contentPathQuerySchema,
  contentWorkspaceParamsSchema,
  copyContentNodeRequestSchema,
  createContentNodeRequestSchema,
  listContentNodesQuerySchema,
  moveContentNodeRequestSchema,
  updateContentNodeRequestSchema,
} from "@nexosophy/contracts";
import {
  bulkContentNodes,
  ContentStoreError,
  copyContentSubtree,
  createContentNode,
  getContentBreadcrumbs,
  getContentNode,
  getContentOperation,
  listContentFavorites,
  listContentNodes,
  listContentRecent,
  markContentRecent,
  moveContentNode,
  resolveContentPath,
  restoreContentSubtree,
  setContentFavorite,
  trashContentSubtree,
  updateContentNode,
} from "@nexosophy/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

function idempotencyKey(request: FastifyRequest): string | undefined {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= 200 ? normalized : undefined;
}

function sendContentError(error: unknown, request: FastifyRequest, reply: FastifyReply): boolean {
  if (!(error instanceof ContentStoreError)) return false;

  const mapping: Record<ContentStoreError["code"], { status: number; apiCode: string }> = {
    NODE_NOT_FOUND: { status: 404, apiCode: "CONTENT_NOT_FOUND" },
    PARENT_NOT_FOUND: { status: 404, apiCode: "CONTENT_PARENT_NOT_FOUND" },
    PARENT_NOT_FOLDER: { status: 422, apiCode: "CONTENT_PARENT_NOT_FOLDER" },
    TARGET_NOT_FOUND: { status: 404, apiCode: "CONTENT_TARGET_NOT_FOUND" },
    CYCLE: { status: 422, apiCode: "CONTENT_CYCLE" },
    NAME_CONFLICT: { status: 409, apiCode: "CONTENT_NAME_CONFLICT" },
    VERSION_CONFLICT: { status: 412, apiCode: "CONTENT_VERSION_CONFLICT" },
    IDEMPOTENCY_CONFLICT: { status: 409, apiCode: "IDEMPOTENCY_CONFLICT" },
    OPERATION_NOT_FOUND: { status: 404, apiCode: "CONTENT_OPERATION_NOT_FOUND" },
    OPERATION_CANCELLED: { status: 409, apiCode: "CONTENT_OPERATION_CANCELLED" },
  };
  const mapped = mapping[error.code];
  sendWorkspaceError(reply, request.id, mapped.status, mapped.apiCode, error.message);
  return true;
}

async function withContentErrorHandling<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  action: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    if (sendContentError(error, request, reply)) return undefined;
    throw error;
  }
}

export async function registerContentRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.get("/v1/workspaces/:workspaceId/nodes", async (request, reply) => {
    const { workspaceId } = contentWorkspaceParamsSchema.parse(request.params);
    const query = listContentNodesQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }

    return withContentErrorHandling(request, reply, () =>
      listContentNodes(pool, {
        workspaceId,
        parentId: query.parentId === "root" ? null : query.parentId,
        cursor: query.cursor,
        limit: query.limit,
        includeTrashed: query.includeTrashed,
        userId: principal.internalUserId,
      }),
    );
  });

  app.post("/v1/workspaces/:workspaceId/nodes", async (request, reply) => {
    const { workspaceId } = contentWorkspaceParamsSchema.parse(request.params);
    const body = createContentNodeRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))
    ) {
      return;
    }

    const node = await withContentErrorHandling(request, reply, () =>
      createContentNode(pool, {
        workspaceId,
        actorUserId: principal.internalUserId,
        parentId: body.parentId ?? null,
        kind: body.kind,
        name: body.name,
        targetNodeId: body.targetNodeId ?? null,
        metadata: body.metadata,
        requestId: request.id,
      }),
    );
    if (node) reply.code(201);
    return node;
  });

  app.get("/v1/workspaces/:workspaceId/nodes/path", async (request, reply) => {
    const { workspaceId } = contentWorkspaceParamsSchema.parse(request.params);
    const query = contentPathQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }

    const node = await resolveContentPath(pool, workspaceId, query.path);
    if (!node) {
      return sendWorkspaceError(
        reply,
        request.id,
        404,
        "CONTENT_NOT_FOUND",
        "Content path not found.",
      );
    }
    return node;
  });

  app.get("/v1/workspaces/:workspaceId/favorites", async (request, reply) => {
    const { workspaceId } = contentWorkspaceParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    return {
      items: await listContentFavorites(pool, workspaceId, principal.internalUserId),
    };
  });

  app.get("/v1/workspaces/:workspaceId/recent", async (request, reply) => {
    const { workspaceId } = contentWorkspaceParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    return {
      items: await listContentRecent(pool, workspaceId, principal.internalUserId),
    };
  });

  app.post("/v1/workspaces/:workspaceId/nodes/bulk", async (request, reply) => {
    const { workspaceId } = contentWorkspaceParamsSchema.parse(request.params);
    const body = bulkContentNodeRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const permission =
      body.operation === "trash"
        ? "content.delete"
        : body.operation === "copy"
          ? "content.create"
          : "content.update";
    if (!(await authorizeWorkspace(pool, principal, workspaceId, permission, request, reply))) {
      return;
    }

    const result = await withContentErrorHandling(request, reply, () =>
      bulkContentNodes(pool, {
        workspaceId,
        actorUserId: principal.internalUserId,
        operation: body.operation,
        nodeIds: body.nodeIds,
        parentId: body.parentId,
        requestId: request.id,
        idempotencyKey: idempotencyKey(request),
      }),
    );
    if (result?.queued.length) reply.code(202);
    return result;
  });

  app.get("/v1/workspaces/:workspaceId/content-operations/:operationId", async (request, reply) => {
    const { workspaceId, operationId } = contentOperationParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    const operation = await getContentOperation(pool, workspaceId, operationId);
    if (!operation) {
      return sendWorkspaceError(
        reply,
        request.id,
        404,
        "CONTENT_OPERATION_NOT_FOUND",
        "Content operation not found.",
      );
    }
    return operation;
  });

  app.get("/v1/workspaces/:workspaceId/nodes/:nodeId", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    const node = await getContentNode(pool, workspaceId, nodeId);
    if (!node) {
      return sendWorkspaceError(
        reply,
        request.id,
        404,
        "CONTENT_NOT_FOUND",
        "Content node not found.",
      );
    }
    return node;
  });

  app.patch("/v1/workspaces/:workspaceId/nodes/:nodeId", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const body = updateContentNodeRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))
    ) {
      return;
    }
    return withContentErrorHandling(request, reply, () =>
      updateContentNode(pool, {
        workspaceId,
        nodeId,
        actorUserId: principal.internalUserId,
        expectedVersion: body.expectedVersion,
        name: body.name,
        metadata: body.metadata,
        requestId: request.id,
      }),
    );
  });

  app.post("/v1/workspaces/:workspaceId/nodes/:nodeId/move", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const body = moveContentNodeRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))
    ) {
      return;
    }
    return withContentErrorHandling(request, reply, () =>
      moveContentNode(pool, {
        workspaceId,
        nodeId,
        actorUserId: principal.internalUserId,
        parentId: body.parentId,
        expectedVersion: body.expectedVersion,
        requestId: request.id,
      }),
    );
  });

  app.post("/v1/workspaces/:workspaceId/nodes/:nodeId/copy", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const body = copyContentNodeRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))
    ) {
      return;
    }
    const result = await withContentErrorHandling(request, reply, () =>
      copyContentSubtree(pool, {
        workspaceId,
        nodeId,
        actorUserId: principal.internalUserId,
        parentId: body.parentId,
        name: body.name,
        requestId: request.id,
        idempotencyKey: idempotencyKey(request),
      }),
    );
    if (result?.status === "queued") reply.code(202);
    return result;
  });

  app.delete("/v1/workspaces/:workspaceId/nodes/:nodeId", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(pool, principal, workspaceId, "content.delete", request, reply))
    ) {
      return;
    }
    const result = await withContentErrorHandling(request, reply, () =>
      trashContentSubtree(pool, {
        workspaceId,
        nodeId,
        actorUserId: principal.internalUserId,
        requestId: request.id,
        idempotencyKey: idempotencyKey(request),
      }),
    );
    if (result?.status === "queued") reply.code(202);
    return result;
  });

  app.post("/v1/workspaces/:workspaceId/nodes/:nodeId/restore", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(pool, principal, workspaceId, "content.delete", request, reply))
    ) {
      return;
    }
    const result = await withContentErrorHandling(request, reply, () =>
      restoreContentSubtree(pool, {
        workspaceId,
        nodeId,
        actorUserId: principal.internalUserId,
        requestId: request.id,
        idempotencyKey: idempotencyKey(request),
      }),
    );
    if (result?.status === "queued") reply.code(202);
    return result;
  });

  app.get("/v1/workspaces/:workspaceId/nodes/:nodeId/breadcrumbs", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    const items = await withContentErrorHandling(request, reply, () =>
      getContentBreadcrumbs(pool, workspaceId, nodeId),
    );
    return items ? { items } : undefined;
  });

  app.put("/v1/workspaces/:workspaceId/nodes/:nodeId/favorite", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const body = contentFavoriteRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    const result = await withContentErrorHandling(request, reply, () =>
      setContentFavorite(pool, {
        workspaceId,
        userId: principal.internalUserId,
        nodeId,
        favorite: body.favorite,
        pinned: body.pinned,
      }),
    );
    if (result === undefined && reply.sent) return;
    return { ok: true };
  });

  app.post("/v1/workspaces/:workspaceId/nodes/:nodeId/recent", async (request, reply) => {
    const { workspaceId, nodeId } = contentNodeParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    const result = await withContentErrorHandling(request, reply, () =>
      markContentRecent(pool, workspaceId, principal.internalUserId, nodeId),
    );
    if (result === undefined && reply.sent) return;
    reply.code(204);
    return;
  });
}