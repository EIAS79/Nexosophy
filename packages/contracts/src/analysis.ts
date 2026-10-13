import{z}from"zod";const uuid=z.string().uuid();
export const analysisDatasetSchema=z.object({name:z.string().trim().min(1).max(240),sourceStructuredDocumentId:uuid.optional(),sourceAssetId:uuid.optional()}).refine(v=>Boolean(v.sourceStructuredDocumentId)!==Boolean(v.sourceAssetId),{message:"Exactly one source is required"});
const op=z.discriminatedUnion("type",[
 z.object({type:z.literal("select"),columns:z.array(z.string().max(64)).min(1).max(500)}),
 z.object({type:z.literal("rename"),from:z.string().max(64),to:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/)}),
 z.object({type:z.literal("filter"),column:z.string().max(64),operator:z.enum(["eq","neq","gt","gte","lt","lte","contains","not_empty"]),value:z.unknown().optional()}),
 z.object({type:z.literal("sort"),column:z.string().max(64),direction:z.enum(["asc","desc"]).default("asc")}),
 z.object({type:z.literal("fill"),column:z.string().max(64),value:z.unknown()}),
 z.object({type:z.literal("drop_missing"),columns:z.array(z.string().max(64)).max(500)}),
 z.object({type:z.literal("cast_number"),column:z.string().max(64)}),
 z.object({type:z.literal("derive"),key:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),formula:z.string().max(1000)})
]);
export const analysisRecipeSchema=z.object({name:z.string().trim().min(1).max(240),description:z.string().max(100000).default(""),operations:z.array(op).min(1).max(100)});
export const analysisRunSchema=z.object({datasetId:uuid,recipeVersionId:uuid,parameters:z.record(z.string(),z.unknown()).default({})});
export const analysisVisualizationSchema=z.object({datasetId:uuid,name:z.string().trim().min(1).max(240),type:z.enum(["bar","line","area","scatter","pie","histogram","table","metric"]),spec:z.object({x:z.string().max(64).optional(),y:z.string().max(64).optional(),series:z.string().max(64).optional(),aggregate:z.enum(["none","sum","avg","count","min","max"]).default("none"),limit:z.number().int().min(1).max(1000).default(100)}),accessibleDescription:z.string().max(2000).default("")});
export const analysisDashboardSchema=z.object({name:z.string().trim().min(1).max(240),description:z.string().max(100000).default(""),visualizationIds:z.array(uuid).max(100),layout:z.record(z.string(),z.unknown()).default({})});
export const analysisExportSchema=z.object({sourceType:z.enum(["dataset","visualization","dashboard"]),sourceId:uuid,format:z.enum(["csv","json","svg","html"])});
