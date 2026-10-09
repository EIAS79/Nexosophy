import{z}from"zod";const uuid=z.string().uuid();
export const integrationProviderSchema=z.enum(["google","microsoft","mendeley"]);
export const oauthStartSchema=z.object({provider:integrationProviderSchema,returnPath:z.string().startsWith("/").max(500).default("/app")});
export const integrationSyncSchema=z.object({resourceType:z.enum(["calendar","files","references"]),direction:z.enum(["import","export","bidirectional"]).default("bidirectional")});
export const integrationConflictResolutionSchema=z.object({resolution:z.enum(["remote","local","manual"]),manualPayload:z.record(z.string(),z.unknown()).optional()});
export const officeSessionSchema=z.object({nodeId:uuid});
