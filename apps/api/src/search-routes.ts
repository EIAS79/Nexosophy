import type { AuthVerifier } from "@nexosophy/auth";
import {
  createRelationRequestSchema,
  createSavedSearchRequestSchema,
  createTagRequestSchema,
  graphQuerySchema,
  reindexRequestSchema,
  searchQuerySchema,
} from "@nexosophy/contracts";
import {
  assignTagToNode,
  clearSearchHistory,
  createContentRelation,
  createSavedSearch,
  createWorkspaceTag,
  deleteContentRelation,
  deleteSavedSearch,
  enqueueDurableJob,
  getSearchIndexStatus,
  getWorkspaceGraph,
  listNodeRelations,
  listSavedSearches,
  listSearchHistory,
  listWorkspaceTags,
  searchWorkspace,
  unassignTagFromNode,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
} from "./workspace-route-common.js";

function csv(value?: string): string[] | undefined {
  if (!value) return undefined;
  const values = value.split(",").map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.get("/v1/workspaces/:workspaceId/search", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = searchQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;

    return searchWorkspace(pool, {
      workspaceId,
      userId: principal.internalUserId,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
      kinds: csv(query.kinds),
      tagIds: csv(query.tagIds),
      ownerUserId: query.ownerUserId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  });

  app.get("/v1/workspaces/:workspaceId/search/tags", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return { items: await listWorkspaceTags(pool, workspaceId) };
  });

  app.post("/v1/workspaces/:workspaceId/search/tags", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createTagRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    const item = await createWorkspaceTag(pool, {
      workspaceId,
      name: body.name,
      color: body.color,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    });
    reply.code(201);
    return item;
  });

  app.post("/v1/workspaces/:workspaceId/nodes/:nodeId/tags/:tagId", async (request, reply) => {
    const { workspaceId, nodeId, tagId } = request.params as {
      workspaceId: string;
      nodeId: string;
      tagId: string;
    };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    await assignTagToNode(pool, {
      workspaceId,
      nodeId,
      tagId,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    });
    reply.code(204);
    return;
  });

  app.delete("/v1/workspaces/:workspaceId/nodes/:nodeId/tags/:tagId", async (request, reply) => {
    const { workspaceId, nodeId, tagId } = request.params as {
      workspaceId: string;
      nodeId: string;
      tagId: string;
    };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    await unassignTagFromNode(pool, {
      workspaceId,
      nodeId,
      tagId,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    });
    reply.code(204);
    return;
  });

  app.get("/v1/workspaces/:workspaceId/nodes/:nodeId/relations", async (request, reply) => {
    const { workspaceId, nodeId } = request.params as { workspaceId: string; nodeId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return listNodeRelations(pool, workspaceId, nodeId);
  });

  app.post("/v1/workspaces/:workspaceId/nodes/:nodeId/relations", async (request, reply) => {
    const { workspaceId, nodeId } = request.params as { workspaceId: string; nodeId: string };
    const body = createRelationRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    const relation = await createContentRelation(pool, {
      workspaceId,
      fromNodeId: nodeId,
      toNodeId: body.toNodeId,
      relationType: body.relationType,
      label: body.label,
      metadata: body.metadata,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    });
    reply.code(201);
    return relation;
  });

  app.delete("/v1/workspaces/:workspaceId/relations/:relationId", async (request, reply) => {
    const { workspaceId, relationId } = request.params as {
      workspaceId: string;
      relationId: string;
    };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    const removed = await deleteContentRelation(pool, {
      workspaceId,
      relationId,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    });
    if (!removed) {
      reply.code(404);
      return { error: { code: "RELATION_NOT_FOUND", message: "Relation not found.", requestId: request.id } };
    }
    reply.code(204);
    return;
  });

  app.get("/v1/workspaces/:workspaceId/search/saved", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return { items: await listSavedSearches(pool, workspaceId, principal.internalUserId) };
  });

  app.post("/v1/workspaces/:workspaceId/search/saved", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createSavedSearchRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    const created = await createSavedSearch(pool, {
      workspaceId,
      userId: principal.internalUserId,
      name: body.name,
      query: body.query,
      shared: body.shared,
    });
    reply.code(201);
    return created;
  });

  app.delete("/v1/workspaces/:workspaceId/search/saved/:savedSearchId", async (request, reply) => {
    const { workspaceId, savedSearchId } = request.params as {
      workspaceId: string;
      savedSearchId: string;
    };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    const removed = await deleteSavedSearch(pool, workspaceId, principal.internalUserId, savedSearchId);
    reply.code(removed ? 204 : 404);
    return;
  });

  app.get("/v1/workspaces/:workspaceId/search/history", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return { items: await listSearchHistory(pool, workspaceId, principal.internalUserId) };
  });

  app.delete("/v1/workspaces/:workspaceId/search/history", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    await clearSearchHistory(pool, workspaceId, principal.internalUserId);
    reply.code(204);
    return;
  });

  app.get("/v1/workspaces/:workspaceId/graph", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = graphQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return getWorkspaceGraph(pool, workspaceId, query.nodeId, query.limit);
  });

  app.get("/v1/workspaces/:workspaceId/search/status", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.read", request, reply))) return;
    return getSearchIndexStatus(pool, workspaceId);
  });

  app.post("/v1/workspaces/:workspaceId/search/reindex", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = reindexRequestSchema.parse(request.body ?? {});
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.update", request, reply))) return;
    const job = await enqueueDurableJob(pool, {
      workspaceId,
      queue: "search",
      jobType: body.scope === "node" ? "index_node" : "reindex_workspace",
      payload: body.scope === "node" ? { nodeId: body.nodeId } : {},
      dedupeKey:
        body.scope === "node"
          ? "search-node-" + body.nodeId
          : "search-workspace-" + workspaceId,
      maxAttempts: 8,
    });
    reply.code(202);
    return job;
  });
}
