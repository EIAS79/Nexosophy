import { z } from "zod";

const uuidSchema = z.string().uuid();

export const crdtRegisterSchema = z.object({
  key: z.string().min(1).max(512),
  value: z.unknown().optional(),
  deleted: z.boolean().default(false),
  lamport: z.number().int().nonnegative(),
  actor: z.string().min(1).max(160),
});
export type CrdtRegister = z.infer<typeof crdtRegisterSchema>;

export const collaborationUpdateSchema = z.object({
  clientId: z.string().min(1).max(160),
  clock: z.number().int().nonnegative(),
  registers: z.array(crdtRegisterSchema).min(1).max(1000),
});
export type CollaborationUpdate = z.infer<typeof collaborationUpdateSchema>;

export const collaborationSnapshotSchema = z.object({
  registers: z.record(z.string(), crdtRegisterSchema),
});
export type CollaborationSnapshot = z.infer<typeof collaborationSnapshotSchema>;

export const collaborationRoomParamsSchema = z.object({
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
});

export const realtimeRoomTokenResponseSchema = z.object({
  token: z.string(),
  websocketUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  permissionVersion: z.number().int().positive(),
  capabilities: z.array(z.enum(["read", "write", "comment"])),
});

export const presenceStateSchema = z.object({
  cursor: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
    })
    .optional(),
  selection: z
    .object({
      anchorKey: z.string().max(512).optional(),
      focusKey: z.string().max(512).optional(),
      objectIds: z.array(z.string().max(160)).max(200).optional(),
    })
    .optional(),
  viewport: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      zoom: z.number().finite().min(0.05).max(20),
    })
    .optional(),
});
export type PresenceState = z.infer<typeof presenceStateSchema>;

export const createCommentRequestSchema = z.object({
  parentCommentId: uuidSchema.optional(),
  body: z.string().trim().min(1).max(10000),
  anchor: z.record(z.string(), z.unknown()).default({}),
  mentionUserIds: z.array(uuidSchema).max(100).default([]),
});

export const commentParamsSchema = z.object({
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
  commentId: uuidSchema,
});

export const collaborationCommentSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
  parentCommentId: uuidSchema.nullable(),
  body: z.string(),
  anchor: z.record(z.string(), z.unknown()),
  createdByUserId: uuidSchema,
  resolvedAt: z.coerce.date().nullable(),
  resolvedByUserId: uuidSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CollaborationComment = z.infer<typeof collaborationCommentSchema>;

export const commentsListQuerySchema = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  includeResolved: z.coerce.boolean().default(true),
});
