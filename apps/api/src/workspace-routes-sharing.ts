import type { AuthVerifier } from "@nexosophy/auth";
import {
  createResourceGrantRequestSchema,
  createShareLinkRequestSchema,
  resolveShareLinkRequestSchema,
} from "@nexosophy/contracts";
import {
  createResourceGrant,
  createShareLink,
  deleteResourceGrant,
  listResourceGrants,
  resolveShareLink,
  revokeShareLink,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

function handleSharingScopeError(
  reply: import("fastify").FastifyReply,
  requestId: string,
  error: unknown,
): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message === "RESOURCE_SCOPE_NOT_FOUND") {
    sendWorkspaceError(reply, requestId, 404, "RESOURCE_SCOPE_NOT_FOUND", "This resource is not available in the selected workspace.");
    return true;
  }
  if (error.message === "GRANT_PRINCIPAL_NOT_ACTIVE") {
    sendWorkspaceError(reply, requestId, 422, "GRANT_PRINCIPAL_NOT_ACTIVE", "The recipient must be an active workspace member.");
    return true;
  }
  return false;
}

export async function registerWorkspaceSharingRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier,
): Promise<void> {
  app.post("/v1/workspaces/:workspaceId/resource-grants", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "sharing.manage", request, reply))) return;
    const parsed = createResourceGrantRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Resource grant input is invalid.");
    }
    if (parsed.data.permission === "workspace.delete") {
      return sendWorkspaceError(reply, request.id, 422, "GRANT_SCOPE_INVALID", "Workspace deletion cannot be delegated through a resource grant.");
    }
    try {
      const grant = await createResourceGrant(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      principalUserId: parsed.data.principalUserId,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
      permission: parsed.data.permission,
      });
      reply.code(201);
      return grant;
    } catch (error) {
      if (handleSharingScopeError(reply, request.id, error)) return;
      throw error;
    }
  });

  app.get("/v1/workspaces/:workspaceId/resource-grants", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "sharing.read", request, reply))) return;
    const query = request.query as { resourceType?: string; resourceId?: string };
    if (!query.resourceType || !query.resourceId) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "resourceType and resourceId are required.");
    }
    return {
      grants: await listResourceGrants(pool, workspaceId, query.resourceType, query.resourceId),
    };
  });

  app.delete("/v1/workspaces/:workspaceId/resource-grants/:grantId", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId, grantId } = request.params as { workspaceId: string; grantId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "sharing.manage", request, reply))) return;
    return { deleted: await deleteResourceGrant(pool, workspaceId, grantId) };
  });

  app.post("/v1/workspaces/:workspaceId/share-links", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "sharing.manage", request, reply))) return;
    const parsed = createShareLinkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Share-link input is invalid.");
    }
    try {
      const share = await createShareLink(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
      allowDownload: parsed.data.allowDownload,
      ...(parsed.data.password ? { password: parsed.data.password } : {}),
      ...(parsed.data.expiresAt ? { expiresAt: new Date(parsed.data.expiresAt) } : {}),
    });
      reply.code(201);
      return share;
    } catch (error) {
      if (handleSharingScopeError(reply, request.id, error)) return;
      throw error;
    }
  });

  app.delete("/v1/workspaces/:workspaceId/share-links/:shareLinkId", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId, shareLinkId } = request.params as { workspaceId: string; shareLinkId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "sharing.manage", request, reply))) return;
    return { revoked: await revokeShareLink(pool, workspaceId, shareLinkId) };
  });

  app.post("/v1/share/:token/resolve", async (request, reply) => {
    const { token } = request.params as { token: string };
    const parsed = resolveShareLinkRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Share link request is invalid.");
    }
    const resolved = await resolveShareLink(pool, token, parsed.data.password);
    if (!resolved) {
      return sendWorkspaceError(reply, request.id, 404, "SHARE_LINK_UNAVAILABLE", "This share link is unavailable.");
    }
    return resolved;
  });
}
