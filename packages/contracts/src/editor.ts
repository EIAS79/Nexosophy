import { z } from "zod";

const uuidSchema = z.string().uuid();

export const richDocumentBlockSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["paragraph", "heading", "bullet", "quote", "code"]),
  text: z.string().max(200_000),
});
export type RichDocumentBlock = z.infer<typeof richDocumentBlockSchema>;

export const richDocumentBodySchema = z.object({
  type: z.literal("doc"),
  blocks: z.array(richDocumentBlockSchema).max(10_000),
});
export type RichDocumentBody = z.infer<typeof richDocumentBodySchema>;

export const documentSchema = z.object({
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
  schemaVersion: z.number().int().positive(),
  body: richDocumentBodySchema,
  revision: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type DocumentRecord = z.infer<typeof documentSchema>;

export const documentParamsSchema = z.object({
  workspaceId: uuidSchema,
  nodeId: uuidSchema,
});

export const saveDocumentRequestSchema = z.object({
  body: richDocumentBodySchema,
  expectedRevision: z.number().int().positive(),
});
export type SaveDocumentRequest = z.infer<typeof saveDocumentRequestSchema>;

export const editorCapabilitiesSchema = z.object({
  nodeId: uuidSchema,
  capabilities: z.array(
    z.enum([
      "title",
      "rich-text",
      "undo-redo",
      "autosave",
      "history",
      "comments-hook",
      "export-hook",
      "offline-recovery",
    ]),
  ),
});
export type EditorCapabilities = z.infer<typeof editorCapabilitiesSchema>;

export const durableJobSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema.nullable(),
  queue: z.string(),
  jobType: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled", "dead_letter"]),
  progress: z.record(z.string(), z.unknown()),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type DurableJob = z.infer<typeof durableJobSchema>;

export const jobParamsSchema = z.object({ jobId: uuidSchema });

export const listJobsQuerySchema = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
