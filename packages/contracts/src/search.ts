import { z } from "zod";

const uuidSchema = z.string().uuid();

export const contentRelationTypeSchema = z.enum([
  "related",
  "references",
  "supports",
  "depends_on",
  "contradicts",
  "duplicates",
  "derived_from",
]);
export type ContentRelationType = z.infer<typeof contentRelationTypeSchema>;

export const tagSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Tag = z.infer<typeof tagSchema>;

export const createTagRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(64).optional(),
});

export const relationSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  fromNodeId: uuidSchema,
  toNodeId: uuidSchema,
  relationType: contentRelationTypeSchema,
  label: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ContentRelation = z.infer<typeof relationSchema>;

export const createRelationRequestSchema = z.object({
  toNodeId: uuidSchema,
  relationType: contentRelationTypeSchema.default("related"),
  label: z.string().trim().min(1).max(160).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().max(500).default(""),
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  kinds: z.string().optional(),
  tagIds: z.string().optional(),
  ownerUserId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResultSchema = z.object({
  nodeId: uuidSchema,
  kind: z.string(),
  title: z.string(),
  path: z.string(),
  snippet: z.string(),
  ownerUserId: uuidSchema,
  updatedAt: z.coerce.date(),
  rank: z.number(),
  tags: z.array(tagSchema),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const savedSearchSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  ownerUserId: uuidSchema,
  name: z.string(),
  query: z.record(z.string(), z.unknown()),
  shared: z.boolean(),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type SavedSearch = z.infer<typeof savedSearchSchema>;

export const createSavedSearchRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  query: z.record(z.string(), z.unknown()),
  shared: z.boolean().default(false),
});

export const searchHistoryItemSchema = z.object({
  queryText: z.string(),
  filters: z.record(z.string(), z.unknown()),
  useCount: z.number().int().positive(),
  lastUsedAt: z.coerce.date(),
});

export const graphQuerySchema = z.object({
  nodeId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const reindexRequestSchema = z.object({
  scope: z.enum(["workspace", "node"]).default("workspace"),
  nodeId: uuidSchema.optional(),
}).refine((value) => value.scope !== "node" || Boolean(value.nodeId), {
  message: "nodeId is required for node reindexing.",
});
