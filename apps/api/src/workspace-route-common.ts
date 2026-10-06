import { hasWorkspacePermission, type AuthPrincipal, type AuthVerifier } from "@nexosophy/auth";
import type { WorkspacePermission } from "@nexosophy/contracts";
import { getWorkspaceAuthorization, type createDatabasePool } from "@nexosophy/db";
import type { FastifyReply, FastifyRequest } from "fastify";

export type DatabasePool = ReturnType<typeof createDatabasePool>;

export const denyWorkspaceAuth: AuthVerifier = {
  async verify() {
    return { authenticated: false, reason: "missing" };
  },
};

function toFetchRequest(request: FastifyRequest): Request {
  const protocol = request.protocol || "http";
  const host = request.headers.host ?? "localhost";
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }
  return new Request(`${protocol}://${host}${request.raw.url ?? request.url}`, {
    method: request.method,
    headers,
  });
}

export function sendWorkspaceError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
) {
  return reply.code(statusCode).send({ error: { code, message, requestId } });
}

export async function requireWorkspacePrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  verifier: AuthVerifier,
): Promise<AuthPrincipal | null> {
  const result = await verifier.verify(toFetchRequest(request));
  if (result.authenticated) return result.principal;
  const forbidden = new Set(["suspended", "deletion_pending", "deleted"]);
  const status = forbidden.has(result.reason) ? 403 : 401;
  sendWorkspaceError(
    reply,
    request.id,
    status,
    status === 403 ? "ACCOUNT_UNAVAILABLE" : "UNAUTHENTICATED",
    status === 403 ? "This account cannot access Nexosophy." : "Authentication is required.",
  );
  return null;
}

export async function authorizeWorkspace(
  pool: DatabasePool,
  principal: AuthPrincipal,
  workspaceId: string,
  permission: WorkspacePermission,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authorization = await getWorkspaceAuthorization(
    pool,
    principal.internalUserId,
    workspaceId,
  );
  if (
    !authorization ||
    authorization.archivedAt ||
    !hasWorkspacePermission(
      {
        role: authorization.role,
        status: authorization.status,
        customPermissions: authorization.customPermissions,
      },
      permission,
    )
  ) {
    sendWorkspaceError(
      reply,
      request.id,
      404,
      "WORKSPACE_NOT_FOUND",
      "Workspace not found or access is unavailable.",
    );
    return null;
  }
  return authorization;
}
