import { z } from "zod";

export const contentNodeKindSchema = z.enum([
  "folder",
  "note",
  "document",
  "whiteboard",
  "dataset",
  "spreadsheet",
  "notebook",
  "report",
  "research_item",
  "lab_record",
  "attachment",
  "shortcut",
]);
export type ContentNodeKind = z.infer<typeof contentNodeKindSchema>;

export const contentNodeSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  kind: contentNodeKindSchema,
  name: z.string(),
  targetNodeId: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  trashedAt: z.coerce.date().nullable(),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  hasChildren: z.boolean(),
  favorite: z.boolean().optional(),
  pinned: z.boolean().optional(),
});
export type ContentNode = z.infer<typeof contentNodeSchema>;

const nodeNameSchema = z.string().trim().min(1).max(255);
const uuidSchema = z.string().uuid();

export const contentWorkspaceParamsSchema = z.object({ workspaceId: uuidSchema });
export const contentNodeParamsSchema = z.object({ workspaceId: uuidSchema, nodeId: uuidSchema });
export const contentOperationParamsSchema = z.object({
  workspaceId: uuidSchema,
  operationId: uuidSchema,
});

export const createContentNodeRequestSchema = z
  .object({
    parentId: uuidSchema.nullable().optional(),
    kind: contentNodeKindSchema,
    name: nodeNameSchema,
    targetNodeId: uuidSchema.nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, context) => {
    if (value.kind === "shortcut" && !value.targetNodeId) {
      context.addIssue({
        code: "custom",
        path: ["targetNodeId"],
        message: "Shortcuts require a target node.",
      });
    }
    if (value.kind !== "shortcut" && value.targetNodeId) {
      context.addIssue({
        code: "custom",
        path: ["targetNodeId"],
        message: "Only shortcuts may specify a target node.",
      });
    }
  });
export type CreateContentNodeRequest = z.infer<typeof createContentNodeRequestSchema>;

export const updateContentNodeRequestSchema = z
  .object({
    name: nodeNameSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((value) => value.name !== undefined || value.metadata !== undefined, {
    message: "At least one content field must be changed.",
  });
export type UpdateContentNodeRequest = z.infer<typeof updateContentNodeRequestSchema>;

export const moveContentNodeRequestSchema = z.object({
  parentId: uuidSchema.nullable(),
  expectedVersion: z.number().int().positive(),
});
export type MoveContentNodeRequest = z.infer<typeof moveContentNodeRequestSchema>;

export const copyContentNodeRequestSchema = z.object({
  parentId: uuidSchema.nullable(),
  name: nodeNameSchema.optional(),
});
export type CopyContentNodeRequest = z.infer<typeof copyContentNodeRequestSchema>;

export const bulkContentNodeRequestSchema = z
  .object({
    operation: z.enum(["move", "copy", "trash"]),
    nodeIds: z.array(uuidSchema).min(1).max(100),
    parentId: uuidSchema.nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.operation === "move" || value.operation === "copy") &&
      value.parentId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["parentId"],
        message: "Move and copy require a destination parent, or null for the workspace root.",
      });
    }
  });
export type BulkContentNodeRequest = z.infer<typeof bulkContentNodeRequestSchema>;

export const listContentNodesQuerySchema = z.object({
  parentId: z.union([uuidSchema, z.literal("root")]).default("root"),
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  includeTrashed: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
});
export type ListContentNodesQuery = z.infer<typeof listContentNodesQuerySchema>;

export const contentPathQuerySchema = z.object({
  path: z.string().min(1).max(4096),
});

export const contentFavoriteRequestSchema = z.object({
  favorite: z.boolean(),
  pinned: z.boolean().default(false),
});

export const contentNodePageSchema = z.object({
  items: z.array(contentNodeSchema),
  nextCursor: z.string().nullable(),
});
export type ContentNodePage = z.infer<typeof contentNodePageSchema>;

export const contentOperationSchema = z.object({
  id: z.string().uuid(),
  operation: z.enum(["copy_subtree", "trash_subtree", "restore_subtree"]),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  processedNodes: z.number().int().nonnegative(),
  totalNodes: z.number().int().nonnegative(),
});
export type ContentOperation = z.infer<typeof contentOperationSchema>;