import { z } from "zod";

const uuidSchema = z.string().uuid();

export const spatialPageModeSchema = z.enum(["infinite", "vertical", "fixed"]);
export type SpatialPageMode = z.infer<typeof spatialPageModeSchema>;

export const spatialBackgroundSchema = z.enum(["plain", "ruled", "grid", "dot"]);
export type SpatialBackgroundKind = z.infer<typeof spatialBackgroundSchema>;

export const spatialElementTypeSchema = z.enum([
  "text_region",
  "ink_stroke",
  "highlighter_stroke",
  "shape",
  "sticky",
  "connector",
  "frame",
  "image",
  "audio_anchor",
  "file_attachment",
  "link_card",
  "embed",
  "group",
]);
export type SpatialElementType = z.infer<typeof spatialElementTypeSchema>;

export const spatialPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  pressure: z.number().finite().min(0).max(1).optional(),
  tiltX: z.number().finite().min(-90).max(90).optional(),
  tiltY: z.number().finite().min(-90).max(90).optional(),
  time: z.number().finite().nonnegative().optional(),
});
export type SpatialPoint = z.infer<typeof spatialPointSchema>;

export const spatialElementPayloadSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, context) => {
    const encoded = JSON.stringify(value);
    if (encoded.length > 2_000_000) {
      context.addIssue({
        code: "custom",
        message: "Spatial element payload exceeds the 2 MB limit.",
      });
    }
  });

export const spatialElementSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
  type: spatialElementTypeSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite(),
  zRank: z.number().int(),
  groupId: uuidSchema.nullable(),
  locked: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type SpatialElement = z.infer<typeof spatialElementSchema>;

export const spatialDocumentSchema = z.object({
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
  pageMode: spatialPageModeSchema,
  backgroundKind: spatialBackgroundSchema,
  paperSize: z.string().min(1).max(32),
  orientation: z.enum(["portrait", "landscape"]),
  settings: z.record(z.string(), z.unknown()),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type SpatialDocument = z.infer<typeof spatialDocumentSchema>;

export const spatialSnapshotSchema = z.object({
  document: spatialDocumentSchema,
  elements: z.array(spatialElementSchema),
});
export type SpatialSnapshot = z.infer<typeof spatialSnapshotSchema>;

export const spatialParamsSchema = z.object({
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
});

export const spatialElementsQuerySchema = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  minX: z.coerce.number().finite().optional(),
  minY: z.coerce.number().finite().optional(),
  maxX: z.coerce.number().finite().optional(),
  maxY: z.coerce.number().finite().optional(),
});

export const updateSpatialDocumentRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  pageMode: spatialPageModeSchema.optional(),
  backgroundKind: spatialBackgroundSchema.optional(),
  paperSize: z.string().trim().min(1).max(32).optional(),
  orientation: z.enum(["portrait", "landscape"]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const upsertSpatialElementSchema = z.object({
  id: uuidSchema,
  type: spatialElementTypeSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(1).max(1_000_000),
  height: z.number().finite().min(1).max(1_000_000),
  rotation: z.number().finite().min(-36000).max(36000).default(0),
  zRank: z.number().int().default(0),
  groupId: uuidSchema.nullable().default(null),
  locked: z.boolean().default(false),
  payload: spatialElementPayloadSchema.default({}),
  expectedVersion: z.number().int().positive().optional(),
});

export const spatialBatchRequestSchema = z.object({
  upserts: z.array(upsertSpatialElementSchema).max(500).default([]),
  deleteIds: z.array(uuidSchema).max(500).default([]),
  idempotencyKey: z.string().trim().min(8).max(200),
}).refine((value) => value.upserts.length > 0 || value.deleteIds.length > 0, {
  message: "Spatial batch must contain at least one mutation.",
});
export type SpatialBatchRequest = z.infer<typeof spatialBatchRequestSchema>;

export const spatialViewportSchema = z.object({
  originX: z.number().finite(),
  originY: z.number().finite(),
  zoom: z.number().finite().min(0.05).max(20),
});
export type SpatialViewport = z.infer<typeof spatialViewportSchema>;

export const updateSpatialViewportRequestSchema = spatialViewportSchema.extend({
  deviceKey: z.string().trim().min(1).max(120).default("default"),
});

export const noteHierarchyItemSchema = z.object({
  id: uuidSchema,
  parentId: uuidSchema.nullable(),
  kind: z.enum(["notebook", "folder", "note"]),
  name: z.string(),
  role: z.enum(["notebook", "section", "page"]),
  rank: z.number().int(),
  color: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type NoteHierarchyItem = z.infer<typeof noteHierarchyItemSchema>;

export const createNoteHierarchyRequestSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("notebook"),
    name: z.string().trim().min(1).max(255),
    parentId: uuidSchema.nullable().default(null),
    color: z.string().trim().max(64).optional(),
  }),
  z.object({
    role: z.literal("section"),
    name: z.string().trim().min(1).max(255),
    parentId: uuidSchema,
    color: z.string().trim().max(64).optional(),
  }),
  z.object({
    role: z.literal("page"),
    name: z.string().trim().min(1).max(255),
    parentId: uuidSchema,
    pageMode: spatialPageModeSchema.default("infinite"),
    color: z.string().trim().max(64).optional(),
  }),
]);

export const reorderNoteHierarchyRequestSchema = z.object({
  parentId: uuidSchema,
  orderedNodeIds: z.array(uuidSchema).min(1).max(1000),
});

export const spatialExportRequestSchema = z.object({
  format: z.enum(["svg", "pdf", "print"]),
  scope: z.enum(["content", "viewport", "fixed-page"]).default("content"),
});
