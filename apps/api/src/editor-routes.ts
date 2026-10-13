import type { AuthVerifier } from "@nexosophy/auth";
import {
  documentParamsSchema,
  saveDocumentRequestSchema,
} from "@nexosophy/contracts";
import {
  DocumentStoreError,
  getDocument,
  saveDocument,
} from "@nexosophy/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { requireIdempotencyKey } from "./api-platform.js";
import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

function sendDocumentError(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (!(error instanceof DocumentStoreError)) return false;
  const mapping: Record<
    DocumentStoreError["code"],
    { status: number; code: string }
  > = {
    DOCUMENT_NOT_FOUND: { status: 404, code: "DOCUMENT_NOT_FOUND" },
    DOCUMENT_NOT_EDITABLE: { status: 422, code: "DOCUMENT_NOT_EDITABLE" },
    DOCUMENT_VERSION_CONFLICT: { status: 412, code: "DOCUMENT_VERSION_CONFLICT" },
    DOCUMENT_TOO_LARGE: { status: 413, code: "DOCUMENT_TOO_LARGE" },
    IDEMPOTENCY_CONFLICT: { status: 409, code: "IDEMPOTENCY_CONFLICT" },
  };
  const mapped = mapping[error.code];
  sendWorkspaceError(reply, request.id, mapped.status, mapped.code, error.message);
  return true;
}

export async function registerEditorRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.get(
    "/v1/workspaces/:workspaceId/documents/:nodeId",
    async (request, reply) => {
      const { workspaceId, nodeId } = documentParamsSchema.parse(request.params);
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

      try {
        return await getDocument(pool, {
          workspaceId,
          nodeId,
        });
      } catch (error) {
        if (sendDocumentError(error, request, reply)) return;
        throw error;
      }
    },
  );

  app.put(
    "/v1/workspaces/:workspaceId/documents/:nodeId",
    async (request, reply) => {
      const { workspaceId, nodeId } = documentParamsSchema.parse(request.params);
      const body = saveDocumentRequestSchema.parse(request.body);
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
      const key = requireIdempotencyKey(request, reply);
      if (!key) return;

      try {
        return await saveDocument(pool, {
          workspaceId,
          nodeId,
          actorUserId: principal.internalUserId,
          expectedRevision: body.expectedRevision,
          body: body.body,
          idempotencyKey: key,
          requestId: request.id,
        });
      } catch (error) {
        if (sendDocumentError(error, request, reply)) return;
        throw error;
      }
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/documents/:nodeId/capabilities",
    async (request, reply) => {
      const { workspaceId, nodeId } = documentParamsSchema.parse(request.params);
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
      return {
        nodeId,
        capabilities: [
          "title",
          "rich-text",
          "undo-redo",
          "autosave",
          "history",
          "comments-hook",
          "export-hook",
          "offline-recovery",
        ],
      };
    },
  );
}
