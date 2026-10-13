import { z } from "zod";
const uuid = z.string().uuid();

export const templateVariableInputSchema = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text","multiline","number","date","select","boolean"]).default("text"),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  options: z.array(z.string().max(200)).max(100).default([]),
});

export const createTemplateRequestSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().max(20000).default(""),
  scope: z.enum(["personal","workspace"]).default("personal"),
  categoryId: uuid.optional(),
  sourceNodeId: uuid,
  roleSuggestions: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  variables: z.array(templateVariableInputSchema).max(100).default([]),
  publish: z.boolean().default(false),
});

export const instantiateTemplateRequestSchema = z.object({
  destinationParentId: uuid.nullable().default(null),
  values: z.record(z.string(), z.unknown()).default({}),
  version: z.number().int().positive().optional(),
});

export const templateGalleryQuerySchema = z.object({
  scope: z.enum(["all","system","personal","workspace"]).default("all"),
  categoryId: uuid.optional(),
  q: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const exportRequestSchema = z.object({
  scope: z.enum(["node","workspace"]),
  nodeId: uuid.optional(),
  format: z.enum(["nexosophy","zip","markdown","html","pdf"]).default("nexosophy"),
  includeRelations: z.boolean().default(true),
}).refine(v => v.scope !== "node" || Boolean(v.nodeId), {message:"nodeId is required for node export."});

export const importRequestSchema = z.object({
  assetId: uuid,
  destinationParentId: uuid.nullable().default(null),
  formatHint: z.string().trim().max(80).optional(),
});

export const transferActionSchema = z.object({action:z.enum(["cancel","retry"])});

export type TransferPublic = {
  id:string;
  workspaceId:string;
  kind:"import"|"export";
  durableJobId:string|null;
  sourceNodeId:string|null;
  sourceAssetId:string|null;
  destinationParentId:string|null;
  format:string;
  fidelity:"native_editable"|"partially_editable"|"preview_only"|"portable_archive";
  artifactFilename:string|null;
  artifactMime:string|null;
  manifestVersion:string|null;
  resultRootNodeIds:string[];
  jobStatus:string|null;
  progress:Record<string,unknown>;
  createdAt:Date;
  updatedAt:Date;
};
