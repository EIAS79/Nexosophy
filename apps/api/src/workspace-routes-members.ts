import {
  canChangeWorkspaceMemberRole,
  canRemoveWorkspaceMember,
  type AuthVerifier,
} from "@nexosophy/auth";
import {
  acceptOwnershipTransferRequestSchema,
  acceptWorkspaceInvitationRequestSchema,
  createOwnershipTransferRequestSchema,
  createWorkspaceInvitationRequestSchema,
  updateWorkspaceMemberRequestSchema,
} from "@nexosophy/contracts";
import {
  acceptOwnershipTransfer,
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeWorkspaceMember,
  requestOwnershipTransfer,
  revokeWorkspaceInvitation,
  updateWorkspaceMember,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

export async function registerWorkspaceMemberRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier,
): Promise<void> {
  app.get("/v1/workspaces/:workspaceId/members", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "members.read", request, reply))) return;
    return { members: await listWorkspaceMembers(pool, workspaceId) };
  });

  app.post("/v1/workspaces/:workspaceId/invitations", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "members.invite", request, reply))) return;
    const parsed = createWorkspaceInvitationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Invitation input is invalid.");
    }
    const invite = await createWorkspaceInvitation(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      email: parsed.data.email,
      role: parsed.data.role,
      expiresInHours: parsed.data.expiresInHours,
      requestId: request.id,
    });
    reply.code(201);
    return invite;
  });

  app.get("/v1/workspaces/:workspaceId/invitations", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "members.invite", request, reply))) return;
    return { invitations: await listWorkspaceInvitations(pool, workspaceId) };
  });

  app.delete("/v1/workspaces/:workspaceId/invitations/:invitationId", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId, invitationId } = request.params as { workspaceId: string; invitationId: string };
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "members.invite", request, reply))) return;
    return { revoked: await revokeWorkspaceInvitation(pool, workspaceId, invitationId) };
  });

  app.post("/v1/workspace-invitations/accept", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const parsed = acceptWorkspaceInvitationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Invitation token is invalid.");
    }
    const result = await acceptWorkspaceInvitation(pool, {
      token: parsed.data.token,
      userId: principal.internalUserId,
      requestId: request.id,
    });
    if (!result.accepted) {
      return sendWorkspaceError(
        reply,
        request.id,
        result.reason === "wrong_recipient" ? 403 : 404,
        "INVITATION_UNAVAILABLE",
        "This invitation cannot be accepted.",
      );
    }
    return result;
  });

  app.patch("/v1/workspaces/:workspaceId/members/:userId", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
    const authorization = await authorizeWorkspace(
      pool, principal, workspaceId, "members.manage", request, reply,
    );
    if (!authorization) return;
    const parsed = updateWorkspaceMemberRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Member update is invalid.");
    }
    const members = await listWorkspaceMembers(pool, workspaceId);
    const target = members.find((member) => member.userId === userId);
    if (!target) {
      return sendWorkspaceError(reply, request.id, 404, "MEMBER_NOT_FOUND", "Member not found.");
    }
    if (target.role === "owner") {
      return sendWorkspaceError(reply, request.id, 422, "OWNERSHIP_TRANSFER_REQUIRED", "Use ownership transfer for the owner role.");
    }
    if (
      !canChangeWorkspaceMemberRole(
        authorization.role,
        target.role,
        parsed.data.role ?? target.role,
      )
    ) {
      return sendWorkspaceError(reply, request.id, 403, "ROLE_CHANGE_FORBIDDEN", "Role or status change is not allowed.");
    }
    const updated = await updateWorkspaceMember(pool, {
      workspaceId,
      userId,
      expectedVersion: parsed.data.expectedVersion,
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    });
    if (!updated) {
      return sendWorkspaceError(reply, request.id, 409, "VERSION_CONFLICT", "Membership changed before this update.");
    }
    return { updated: true };
  });

  app.delete("/v1/workspaces/:workspaceId/members/:userId", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
    const authorization = await authorizeWorkspace(pool, principal, workspaceId, "members.manage", request, reply);
    if (!authorization) return;
    const target = (await listWorkspaceMembers(pool, workspaceId)).find((member) => member.userId === userId);
    if (!target) return sendWorkspaceError(reply, request.id, 404, "MEMBER_NOT_FOUND", "Member not found.");
    if (!canRemoveWorkspaceMember(authorization.role, target.role)) {
      return sendWorkspaceError(reply, request.id, 403, "MEMBER_REMOVE_FORBIDDEN", "Member cannot be removed by this role.");
    }
    return { removed: await removeWorkspaceMember(pool, workspaceId, userId) };
  });

  app.post("/v1/workspaces/:workspaceId/ownership-transfer", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const { workspaceId } = request.params as { workspaceId: string };
    const authorization = await authorizeWorkspace(pool, principal, workspaceId, "workspace.delete", request, reply);
    if (authorization?.role !== "owner") return;
    const parsed = createOwnershipTransferRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Transfer input is invalid.");
    }
    const transfer = await requestOwnershipTransfer(pool, {
      workspaceId,
      fromUserId: principal.internalUserId,
      toUserId: parsed.data.toUserId,
      expiresInHours: parsed.data.expiresInHours,
    });
    if (!transfer) {
      return sendWorkspaceError(reply, request.id, 422, "TRANSFER_TARGET_INVALID", "Target must be an active member.");
    }
    reply.code(201);
    return transfer;
  });

  app.post("/v1/ownership-transfers/accept", async (request, reply) => {
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const parsed = acceptOwnershipTransferRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Ownership transfer token is invalid.");
    }
    const accepted = await acceptOwnershipTransfer(pool, {
      token: parsed.data.token,
      userId: principal.internalUserId,
    });
    if (!accepted) {
      return sendWorkspaceError(reply, request.id, 404, "TRANSFER_UNAVAILABLE", "This ownership transfer is unavailable.");
    }
    return { accepted: true };
  });
}
