import { z } from "zod";

const uuidSchema = z.string().uuid();
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const assetTrustStateSchema = z.enum([
  "pending_upload",
  "pending_scan",
  "quarantined",
  "trusted",
  "rejected",
  "deleted",
]);
export type AssetTrustState = z.infer<typeof assetTrustStateSchema>;

export const uploadSessionStatusSchema = z.enum([
  "initiated",
  "uploading",
  "completing",
  "scanning",
  "processing",
  "complete",
  "aborted",
  "expired",
  "failed",
]);
export type UploadSessionStatus = z.infer<typeof uploadSessionStatusSchema>;

export const assetVariantKindSchema = z.enum([
  "thumbnail",
  "image_preview",
  "pdf_preview",
  "pdf_text",
  "office_preview",
  "media_metadata",
  "waveform",
  "video_poster",
]);
export type AssetVariantKind = z.infer<typeof assetVariantKindSchema>;

export const assetSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  nodeId: uuidSchema.nullable(),
  originalFilename: z.string(),
  declaredMime: z.string(),
  detectedMime: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string().nullable(),
  trustState: assetTrustStateSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Asset = z.infer<typeof assetSchema>;

export const uploadSessionSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  assetId: uuidSchema,
  status: uploadSessionStatusSchema,
  expectedSizeBytes: z.number().int().nonnegative(),
  partSizeBytes: z.number().int().positive(),
  expectedParts: z.number().int().positive(),
  uploadedBytes: z.number().int().nonnegative(),
  expiresAt: z.coerce.date(),
});
export type UploadSession = z.infer<typeof uploadSessionSchema>;

export const initiateUploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(512),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024 * 1024),
  checksumSha256: sha256Schema.optional(),
  parentId: uuidSchema.nullable().default(null),
});
export type InitiateUploadRequest = z.infer<typeof initiateUploadRequestSchema>;

export const uploadWorkspaceParamsSchema = z.object({ workspaceId: uuidSchema });
export const uploadSessionParamsSchema = z.object({
  workspaceId: uuidSchema,
  uploadSessionId: uuidSchema,
});
export const uploadPartParamsSchema = uploadSessionParamsSchema.extend({
  partNumber: z.coerce.number().int().min(1).max(10000),
});
export const assetParamsSchema = z.object({
  workspaceId: uuidSchema,
  assetId: uuidSchema,
});
export const assetVariantParamsSchema = assetParamsSchema.extend({
  variantKind: assetVariantKindSchema,
});

export const recordUploadPartRequestSchema = z.object({
  etag: z.string().trim().min(1).max(512),
  sizeBytes: z.number().int().positive().max(134217728),
  checksumSha256: sha256Schema.optional(),
});
export type RecordUploadPartRequest = z.infer<typeof recordUploadPartRequestSchema>;

export const completeUploadRequestSchema = z.object({
  checksumSha256: sha256Schema.optional(),
});
export type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>;

export const signedUploadPartSchema = z.object({
  partNumber: z.number().int().positive(),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  expiresAt: z.string().datetime(),
});
export type SignedUploadPart = z.infer<typeof signedUploadPartSchema>;

export const assetVariantSchema = z.object({
  id: uuidSchema,
  kind: assetVariantKindSchema,
  status: z.enum(["queued", "processing", "ready", "failed"]),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  fidelityLabel: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type AssetVariant = z.infer<typeof assetVariantSchema>;
