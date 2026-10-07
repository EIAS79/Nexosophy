import type { AuthVerifier } from "@nexosophy/auth";
import {
  assetParamsSchema,
  assetVariantParamsSchema,
  completeUploadRequestSchema,
  initiateUploadRequestSchema,
  recordUploadPartRequestSchema,
  uploadPartParamsSchema,
  uploadSessionParamsSchema,
} from "@nexosophy/contracts";
import {
  abortAssetUpload,
  attachMultipartUploadId,
  beginUploadCompletion,
  getAsset,
  getAssetVariantStorageKey,
  getUploadSession,
  initiateAssetUpload,
  listAssetVariants,
  markUploadVerified,
  recordUploadPart,
  requestAssetDeletion,
} from "@nexosophy/db";
import type { StorageAdapter } from "@nexosophy/storage";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

function sendAssetError(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (!(error instanceof Error)) return false;

  const mapping: Record<string, { status: number; code: string; message: string }> = {
    UPLOAD_CONCURRENCY_LIMIT: {
      status: 429,
      code: "UPLOAD_CONCURRENCY_LIMIT",
      message: "Too many uploads are active in this workspace.",
    },
    UPLOAD_QUOTA_EXCEEDED: {
      status: 413,
      code: "UPLOAD_QUOTA_EXCEEDED",
      message: "This upload exceeds the workspace storage quota.",
    },
    UPLOAD_SESSION_UNAVAILABLE: {
      status: 404,
      code: "UPLOAD_SESSION_UNAVAILABLE",
      message: "Upload session not found or unavailable.",
    },
    UPLOAD_SESSION_EXPIRED: {
      status: 410,
      code: "UPLOAD_SESSION_EXPIRED",
      message: "This upload session has expired.",
    },
    UPLOAD_SESSION_STATE_CONFLICT: {
      status: 409,
      code: "UPLOAD_SESSION_STATE_CONFLICT",
      message: "The upload session is not in a compatible state.",
    },
    UPLOAD_PART_OUT_OF_RANGE: {
      status: 422,
      code: "UPLOAD_PART_OUT_OF_RANGE",
      message: "The requested upload part is outside the session range.",
    },
    UPLOAD_PARTS_INCOMPLETE: {
      status: 409,
      code: "UPLOAD_PARTS_INCOMPLETE",
      message: "All upload parts must be recorded before completion.",
    },
    UPLOAD_SIZE_MISMATCH: {
      status: 422,
      code: "UPLOAD_SIZE_MISMATCH",
      message: "The uploaded object size does not match the declared size.",
    },
    UPLOAD_CHECKSUM_MISMATCH: {
      status: 422,
      code: "UPLOAD_CHECKSUM_MISMATCH",
      message: "The uploaded object checksum does not match the declared checksum.",
    },
  };

  const mapped = mapping[error.message];
  if (!mapped) return false;
  sendWorkspaceError(reply, request.id, mapped.status, mapped.code, mapped.message);
  return true;
}

function storageUnavailable(reply: FastifyReply, requestId: string) {
  return sendWorkspaceError(
    reply,
    requestId,
    503,
    "STORAGE_UNAVAILABLE",
    "Object storage is not configured for this environment.",
  );
}

export async function registerAssetRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  storage: StorageAdapter | null,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.post("/v1/workspaces/:workspaceId/uploads/initiate", async (request, reply) => {
    if (!storage) return storageUnavailable(reply, request.id);
    const { workspaceId } = uploadSessionParamsSchema
      .pick({ workspaceId: true })
      .parse(request.params);
    const body = initiateUploadRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))) {
      return;
    }

    try {
      const created = await initiateAssetUpload(pool, {
        workspaceId,
        userId: principal.internalUserId,
        parentId: body.parentId,
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        checksumSha256: body.checksumSha256,
        requestId: request.id,
      });

      try {
        const multipart = await storage.createMultipartUpload({
          key: created.asset.objectKey,
          contentType: body.mimeType,
          metadata: {
            workspace: workspaceId,
            asset: created.asset.id,
          },
        });
        await attachMultipartUploadId(
          pool,
          workspaceId,
          created.session.id,
          multipart.uploadId,
        );
      } catch (error) {
        await abortAssetUpload(pool, {
          workspaceId,
          sessionId: created.session.id,
          userId: principal.internalUserId,
          requestId: request.id,
        });
        throw error;
      }

      reply.code(201);
      return {
        asset: created.asset,
        upload: {
          ...created.session,
          status: "uploading",
        },
      };
    } catch (error) {
      if (sendAssetError(error, request, reply)) return;
      throw error;
    }
  });

  app.get("/v1/workspaces/:workspaceId/uploads/:uploadSessionId", async (request, reply) => {
    const { workspaceId, uploadSessionId } = uploadSessionParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    const state = await getUploadSession(pool, workspaceId, uploadSessionId);
    if (!state || state.session.userId !== principal.internalUserId) {
      return sendWorkspaceError(
        reply,
        request.id,
        404,
        "UPLOAD_SESSION_UNAVAILABLE",
        "Upload session not found or unavailable.",
      );
    }
    return state;
  });

  app.post(
    "/v1/workspaces/:workspaceId/uploads/:uploadSessionId/parts/:partNumber/sign",
    async (request, reply) => {
      if (!storage) return storageUnavailable(reply, request.id);
      const { workspaceId, uploadSessionId, partNumber } = uploadPartParamsSchema.parse(
        request.params,
      );
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))
      ) {
        return;
      }

      const state = await getUploadSession(pool, workspaceId, uploadSessionId);
      if (
        !state ||
        state.session.userId !== principal.internalUserId ||
        !state.session.storageUploadId ||
        !["initiated", "uploading"].includes(state.session.status) ||
        state.session.expiresAt <= new Date()
      ) {
        return sendWorkspaceError(
          reply,
          request.id,
          404,
          "UPLOAD_SESSION_UNAVAILABLE",
          "Upload session not found or unavailable.",
        );
      }
      if (partNumber > state.session.expectedParts) {
        return sendWorkspaceError(
          reply,
          request.id,
          422,
          "UPLOAD_PART_OUT_OF_RANGE",
          "The requested upload part is outside the session range.",
        );
      }

      const expiresInSeconds = 15 * 60;
      const signed = await storage.createMultipartPartUrl({
        key: state.asset.objectKey,
        uploadId: state.session.storageUploadId,
        partNumber,
        expiresInSeconds,
      });
      return {
        partNumber,
        ...signed,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      };
    },
  );

  app.put(
    "/v1/workspaces/:workspaceId/uploads/:uploadSessionId/parts/:partNumber",
    async (request, reply) => {
      const { workspaceId, uploadSessionId, partNumber } = uploadPartParamsSchema.parse(
        request.params,
      );
      const body = recordUploadPartRequestSchema.parse(request.body);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))
      ) {
        return;
      }

      try {
        return await recordUploadPart(pool, {
          workspaceId,
          sessionId: uploadSessionId,
          userId: principal.internalUserId,
          partNumber,
          etag: body.etag,
          sizeBytes: body.sizeBytes,
          checksumSha256: body.checksumSha256,
        });
      } catch (error) {
        if (sendAssetError(error, request, reply)) return;
        throw error;
      }
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/uploads/:uploadSessionId/complete",
    async (request, reply) => {
      if (!storage) return storageUnavailable(reply, request.id);
      const { workspaceId, uploadSessionId } = uploadSessionParamsSchema.parse(request.params);
      completeUploadRequestSchema.parse(request.body ?? {});
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))
      ) {
        return;
      }

      try {
        const state = await beginUploadCompletion(pool, {
          workspaceId,
          sessionId: uploadSessionId,
          userId: principal.internalUserId,
        });
        if (!state.session.storageUploadId) {
          throw new Error("UPLOAD_SESSION_STATE_CONFLICT");
        }
        const completed = await storage.completeMultipartUpload({
          key: state.asset.objectKey,
          uploadId: state.session.storageUploadId,
          parts: state.parts.map((part) => ({
            partNumber: part.partNumber,
            etag: part.etag,
          })),
        });
        const head = await storage.headObject(state.asset.objectKey);
        let checksumHex: string | null = null;
        if (head.checksumSha256) {
          try {
            checksumHex = Buffer.from(head.checksumSha256, "base64").toString("hex");
          } catch {
            checksumHex = null;
          }
        }
        const asset = await markUploadVerified(pool, {
          workspaceId,
          sessionId: uploadSessionId,
          userId: principal.internalUserId,
          etag: completed.etag ?? head.etag,
          actualSizeBytes: head.size,
          providerChecksumSha256: checksumHex,
          requestId: request.id,
        });
        reply.code(202);
        return { asset, status: "scanning" };
      } catch (error) {
        if (sendAssetError(error, request, reply)) return;
        throw error;
      }
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/uploads/:uploadSessionId/abort",
    async (request, reply) => {
      if (!storage) return storageUnavailable(reply, request.id);
      const { workspaceId, uploadSessionId } = uploadSessionParamsSchema.parse(request.params);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(pool, principal, workspaceId, "content.delete", request, reply))
      ) {
        return;
      }
      try {
        const aborted = await abortAssetUpload(pool, {
          workspaceId,
          sessionId: uploadSessionId,
          userId: principal.internalUserId,
          requestId: request.id,
        });
        if (aborted.storageUploadId) {
          await storage.abortMultipartUpload({
            key: aborted.objectKey,
            uploadId: aborted.storageUploadId,
          });
        }
        reply.code(204);
        return;
      } catch (error) {
        if (sendAssetError(error, request, reply)) return;
        throw error;
      }
    },
  );

  app.get("/v1/workspaces/:workspaceId/assets/:assetId", async (request, reply) => {
    const { workspaceId, assetId } = assetParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) {
      return;
    }
    const asset = await getAsset(pool, workspaceId, assetId);
    if (!asset) {
      return sendWorkspaceError(
        reply,
        request.id,
        404,
        "ASSET_NOT_FOUND",
        "Asset not found.",
      );
    }
    return {
      asset,
      variants: await listAssetVariants(pool, workspaceId, assetId),
    };
  });

  app.post(
    "/v1/workspaces/:workspaceId/assets/:assetId/download-url",
    async (request, reply) => {
      if (!storage) return storageUnavailable(reply, request.id);
      const { workspaceId, assetId } = assetParamsSchema.parse(request.params);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))
      ) {
        return;
      }
      const asset = await getAsset(pool, workspaceId, assetId);
      if (!asset || asset.trustState !== "trusted") {
        return sendWorkspaceError(
          reply,
          request.id,
          404,
          "ASSET_NOT_AVAILABLE",
          "Asset is not available for download.",
        );
      }
      const expiresInSeconds = 5 * 60;
      const signed = await storage.createDownloadUrl({
        key: asset.objectKey,
        expiresInSeconds,
      });
      return {
        ...signed,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/assets/:assetId/variants/:variantKind/download-url",
    async (request, reply) => {
      if (!storage) return storageUnavailable(reply, request.id);
      const { workspaceId, assetId, variantKind } = assetVariantParamsSchema.parse(request.params);
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))
      ) {
        return;
      }
      const asset = await getAsset(pool, workspaceId, assetId);
      if (!asset || asset.trustState !== "trusted") {
        return sendWorkspaceError(
          reply,
          request.id,
          404,
          "ASSET_NOT_AVAILABLE",
          "Asset is not available.",
        );
      }
      const key = await getAssetVariantStorageKey(pool, workspaceId, assetId, variantKind);
      if (!key) {
        return sendWorkspaceError(
          reply,
          request.id,
          404,
          "ASSET_VARIANT_NOT_AVAILABLE",
          "The requested preview is not available.",
        );
      }
      const expiresInSeconds = 5 * 60;
      const signed = await storage.createDownloadUrl({ key, expiresInSeconds });
      return {
        ...signed,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      };
    },
  );

  app.delete("/v1/workspaces/:workspaceId/assets/:assetId", async (request, reply) => {
    const { workspaceId, assetId } = assetParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.delete", request, reply))) {
      return;
    }
    await requestAssetDeletion(pool, {
      workspaceId,
      assetId,
      actorUserId: principal.internalUserId,
      requestId: request.id,
    });
    reply.code(202);
    return { status: "queued" };
  });
}
