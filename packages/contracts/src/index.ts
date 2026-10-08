import { z } from "zod";

export const serviceStatusSchema = z.enum(["ok", "degraded", "unavailable"]);

export const healthResponseSchema = z.object({
  service: z.string().min(1),
  status: serviceStatusSchema,
  version: z.string().min(1),
  timestamp: z.string().datetime(),
  requestId: z.string().optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export * from "./identity.js";
export * from "./workspace.js";
export * from "./content.js";
export * from "./storage.js";
export * from "./editor.js";

export * from "./history.js";

export * from "./collaboration.js";

export * from "./spatial.js";
