import { randomUUID } from "node:crypto";

import {
  createRealtimeRoomToken,
  hasWorkspacePermission,
  type AuthVerifier,
} from "@nexosophy/auth";
import {
  collaborationRoomParamsSchema,
  commentParamsSchema,
  commentsListQuerySchema,
  createCommentRequestSchema,
} from "@nexosophy/contracts";
import {
  createComment,
  getCollaborationRoomState,
  getContentNode,
  listComments,
  resolveComment,
} from "@nexosophy/db";
import { parseRealtimePublicUrl, parseRealtimeTokenSecret } from "@nexosophy/config";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

export async function registerCollaborationRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.post(
    "/v1/workspaces/:workspaceId/nodes/:nodeId/realtime-token",
    async (request, reply) => {
      const { workspaceId, nodeId } = collaborationRoomParamsSchema.parse(request.params);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      const authorization = await authorizeWorkspace(
        pool,
        principal,
        workspaceId,
        "content.read",
        request,
        reply,
      );
      if (!authorization) return;
      const node = await getContentNode(pool, workspaceId, nodeId);
      if (!node) {
        return sendWorkspaceError(
          reply,
          request.id,
          404,
          "NODE_NOT_FOUND",
          "Content node not found.",
        );
      }

      const authInput = {
        role: authorization.role,
        status: authorization.status,
        customPermissions: authorization.customPermissions,
      };
      const capabilities: Array<"read" | "write" | "comment"> = ["read"];
      if (hasWorkspacePermission(authInput, "content.update")) {
        capabilities.push("write", "comment");
      }

      const ttlSeconds = 5 * 60;
      const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
      const token = createRealtimeRoomToken(
        {
          v: 1,
          workspaceId,
          nodeId,
          userId: principal.internalUserId,
          permissionVersion: authorization.permissionVersion,
          capabilities,
          exp,
          nonce: randomUUID(),
        },
        parseRealtimeTokenSecret(),
      );
      const base = parseRealtimePublicUrl().replace(/\/$/, "");
      return {
        token,
        websocketUrl:
          base +
          "/v1/rooms/" +
          encodeURIComponent(workspaceId) +
          "/" +
          encodeURIComponent(nodeId),
        expiresAt: new Date(exp * 1000).toISOString(),
        permissionVersion: authorization.permissionVersion,
        capabilities,
      };
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/nodes/:nodeId/collaboration-state",
    async (request, reply) => {
      const { workspaceId, nodeId } = collaborationRoomParamsSchema.parse(request.params);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(
          pool,
          principal,
          workspaceId,
          "content.read",
          request,
          reply,
        ))
      ) {
        return;
      }
      return getCollaborationRoomState(pool, workspaceId, nodeId);
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/nodes/:nodeId/comments",
    async (request, reply) => {
      const { workspaceId, nodeId } = collaborationRoomParamsSchema.parse(request.params);
      const query = commentsListQuerySchema.parse(request.query);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(
          pool,
          principal,
          workspaceId,
          "content.read",
          request,
          reply,
        ))
      ) {
        return;
      }
      return listComments(pool, {
        workspaceId,
        nodeId,
        limit: query.limit,
        cursor: query.cursor,
        includeResolved: query.includeResolved,
      });
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/nodes/:nodeId/comments",
    async (request, reply) => {
      const { workspaceId, nodeId } = collaborationRoomParamsSchema.parse(request.params);
      const body = createCommentRequestSchema.parse(request.body);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(
          pool,
          principal,
          workspaceId,
          "content.update",
          request,
          reply,
        ))
      ) {
        return;
      }
      const created = await createComment(pool, {
        workspaceId,
        nodeId,
        parentCommentId: body.parentCommentId,
        body: body.body,
        anchor: body.anchor,
        mentionUserIds: body.mentionUserIds,
        actorUserId: principal.internalUserId,
        requestId: request.id,
      });
      reply.code(201);
      return created;
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/nodes/:nodeId/comments/:commentId/resolve",
    async (request, reply) => {
      const { workspaceId, nodeId, commentId } = commentParamsSchema.parse(request.params);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(
          pool,
          principal,
          workspaceId,
          "content.update",
          request,
          reply,
        ))
      ) {
        return;
      }
      const resolved =
        (request.body as { resolved?: unknown } | null)?.resolved !== false;
      return resolveComment(pool, {
        workspaceId,
        nodeId,
        commentId,
        actorUserId: principal.internalUserId,
        resolved,
        requestId: request.id,
      });
    },
  );
}
