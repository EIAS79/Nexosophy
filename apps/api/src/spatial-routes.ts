import type { AuthVerifier } from "@nexosophy/auth";
import {
  createNoteHierarchyRequestSchema,
  reorderNoteHierarchyRequestSchema,
  spatialBatchRequestSchema,
  spatialElementsQuerySchema,
  spatialExportRequestSchema,
  spatialParamsSchema,
  updateSpatialDocumentRequestSchema,
  updateSpatialViewportRequestSchema,
} from "@nexosophy/contracts";
import {
  appendWorkspaceAuditEvent,
  createNoteHierarchyItem,
  getSpatialSnapshot,
  getSpatialViewport,
  listNoteHierarchy,
  listSpatialElements,
  mutateSpatialElements,
  reorderNoteHierarchy,
  saveSpatialViewport,
  updateSpatialDocument,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
} from "./workspace-route-common.js";

export async function registerSpatialRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.get("/v1/workspaces/:workspaceId/spatial/:nodeId", async (request, reply) => {
    const { workspaceId, nodeId } = spatialParamsSchema.parse(request.params);
    const query = spatialElementsQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }

    const snapshot = await getSpatialSnapshot(pool, { workspaceId, nodeId });
    const elements = await listSpatialElements(pool, {
      workspaceId,
      nodeId,
      limit: query.limit,
      cursor: query.cursor,
      bounds: {
        minX: query.minX,
        minY: query.minY,
        maxX: query.maxX,
        maxY: query.maxY,
      },
    });
    return {
      document: snapshot.document,
      elements: elements.items,
      nextCursor: elements.nextCursor,
    };
  });

  app.put("/v1/workspaces/:workspaceId/spatial/:nodeId", async (request, reply) => {
    const { workspaceId, nodeId } = spatialParamsSchema.parse(request.params);
    const body = updateSpatialDocumentRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) {
      return;
    }
    return updateSpatialDocument(pool, {
      workspaceId,
      nodeId,
      actorUserId: principal.internalUserId,
      expectedVersion: body.expectedVersion,
      pageMode: body.pageMode,
      backgroundKind: body.backgroundKind,
      paperSize: body.paperSize,
      orientation: body.orientation,
      settings: body.settings,
      requestId: request.id,
    });
  });

  app.post("/v1/workspaces/:workspaceId/spatial/:nodeId/elements", async (request, reply) => {
    const { workspaceId, nodeId } = spatialParamsSchema.parse(request.params);
    const body = spatialBatchRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) {
      return;
    }
    return mutateSpatialElements(pool, {
      workspaceId,
      nodeId,
      actorUserId: principal.internalUserId,
      upserts: body.upserts,
      deleteIds: body.deleteIds,
      idempotencyKey: body.idempotencyKey,
      requestId: request.id,
    });
  });

  app.get("/v1/workspaces/:workspaceId/spatial/:nodeId/viewport", async (request, reply) => {
    const { workspaceId, nodeId } = spatialParamsSchema.parse(request.params);
    const deviceKey =
      typeof (request.query as { deviceKey?: unknown } | null)?.deviceKey === "string"
        ? String((request.query as { deviceKey: string }).deviceKey).slice(0, 120)
        : "default";
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    return getSpatialViewport(pool, {
      workspaceId,
      nodeId,
      userId: principal.internalUserId,
      deviceKey,
    });
  });

  app.put("/v1/workspaces/:workspaceId/spatial/:nodeId/viewport", async (request, reply) => {
    const { workspaceId, nodeId } = spatialParamsSchema.parse(request.params);
    const body = updateSpatialViewportRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    await saveSpatialViewport(pool, {
      workspaceId,
      nodeId,
      userId: principal.internalUserId,
      deviceKey: body.deviceKey,
      originX: body.originX,
      originY: body.originY,
      zoom: body.zoom,
    });
    reply.code(204);
    return;
  });

  app.get("/v1/workspaces/:workspaceId/notes/hierarchy", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    return { items: await listNoteHierarchy(pool, workspaceId) };
  });

  app.post("/v1/workspaces/:workspaceId/notes/hierarchy", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createNoteHierarchyRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))) {
      return;
    }
    const created = await createNoteHierarchyItem(pool, {
      ...body,
      workspaceId,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    } as Parameters<typeof createNoteHierarchyItem>[1]);
    reply.code(201);
    return created;
  });

  app.post("/v1/workspaces/:workspaceId/notes/reorder", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = reorderNoteHierarchyRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) {
      return;
    }
    await reorderNoteHierarchy(pool, {
      workspaceId,
      parentId: body.parentId,
      orderedNodeIds: body.orderedNodeIds,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    });
    reply.code(204);
    return;
  });

  app.post("/v1/workspaces/:workspaceId/spatial/:nodeId/export", async (request, reply) => {
    const { workspaceId, nodeId } = spatialParamsSchema.parse(request.params);
    const body = spatialExportRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    await appendWorkspaceAuditEvent(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      action: "spatial.exported",
      targetType: "node",
      targetId: nodeId,
      requestId: request.id,
      metadata: { format: body.format, scope: body.scope },
    });
    return {
      authorized: true,
      format: body.format,
      scope: body.scope,
      generatedBy: "client",
    };
  });
}
