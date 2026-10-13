import { z } from "zod";

const uuidSchema = z.string().uuid();

export const documentVersionReasonSchema = z.enum(["checkpoint", "manual", "restore"]);

export const documentVersionSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
  sourceRevision: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  reason: documentVersionReasonSchema,
  label: z.string().nullable(),
  createdByUserId: uuidSchema,
  createdAt: z.coerce.date(),
});
export type DocumentVersion = z.infer<typeof documentVersionSchema>;

export const documentVersionParamsSchema = z.object({
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
  versionId: uuidSchema,
});

export const createCheckpointRequestSchema = z.object({
  label: z.string().trim().min(1).max(160).optional(),
});

export const trashListQuerySchema = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const trashEntrySchema = z.object({
  nodeId: uuidSchema,
  name: z.string(),
  kind: z.string(),
  trashedAt: z.coerce.date(),
  purgeAt: z.coerce.date(),
  daysRemaining: z.number().int().nonnegative(),
  parentId: uuidSchema.nullable(),
});
export type TrashEntry = z.infer<typeof trashEntrySchema>;

export const auditListQuerySchema = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().min(1).max(120).optional(),
});

export const auditEventSchema = z.object({
  id: uuidSchema,
  actorUserId: uuidSchema.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  requestId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const permanentDeleteRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});
