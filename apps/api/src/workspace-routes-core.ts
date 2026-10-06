import type { AuthVerifier } from "@nexosophy/auth";
import {
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
} from "@nexosophy/contracts";
import {
  appendWorkspaceAuditEvent,
  archiveWorkspace,
  createWorkspace,
  ensurePersonalWorkspace,
  listUserWorkspaces,
  listWorkspaceAuditEvents,
  updateWorkspace,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

export async function registerWorkspaceCoreRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier,
): Promise<void> {
  app.get("/v1/workspaces", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    await ensurePersonalWorkspace(pool, principal.internalUserId);
    return { workspaces: await listUserWorkspaces(pool, principal.internalUserId) };
  });

  app.post("/v1/workspaces", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const parsed = createWorkspaceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Workspace input is invalid.");
    }
    const workspace = await createWorkspace(pool, {
      userId: principal.internalUserId,
      name: parsed.data.name,
      type: parsed.data.type,
      requestId: request.id,
    });
    reply.code(201);
    return workspace;
  });

  app.patch("/v1/workspaces/:workspaceId", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.update", request, reply))) return;
    const parsed = updateWorkspaceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Workspace update is invalid.");
    }
    const workspace = await updateWorkspace(pool, workspaceId, parsed.data.expectedVersion, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    });
    if (!workspace) {
      return sendWorkspaceError(reply, request.id, 409, "VERSION_CONFLICT", "Workspace changed before this update.");
    }
    await appendWorkspaceAuditEvent(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      action: "workspace.updated",
      targetType: "workspace",
      targetId: workspaceId,
      requestId: request.id,
    });
    return workspace;
  });

  app.delete("/v1/workspaces/:workspaceId", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.delete", request, reply))) return;
    try {
      const archived = await archiveWorkspace(pool, workspaceId);
      if (!archived) {
        return sendWorkspaceError(reply, request.id, 404, "WORKSPACE_NOT_FOUND", "Workspace not found.");
      }
      await appendWorkspaceAuditEvent(pool, {
        workspaceId,
        actorUserId: principal.internalUserId,
        action: "workspace.archived",
        targetType: "workspace",
        targetId: workspaceId,
        requestId: request.id,
      });
      return { archived: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Personal workspaces")) {
        return sendWorkspaceError(reply, request.id, 422, "PERSONAL_WORKSPACE_REQUIRED", error.message);
      }
      throw error;
    }
  });

  app.get("/v1/workspaces/:workspaceId/audit", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "workspace.read", request, reply))) return;
    return { events: await listWorkspaceAuditEvents(pool, workspaceId) };
  });
}
