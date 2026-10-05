import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const appEnvSchema = z.enum(["local", "preview", "staging", "production"]);

export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  APP_ENV: appEnvSchema.default("local"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const dataEnvSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
});

export const apiEnvSchema = dataEnvSchema.extend({
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export const workerEnvSchema = dataEnvSchema.extend({
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  WORKER_HEALTH_HOST: z.string().min(1).default("0.0.0.0"),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(4200),
});

export const realtimeEnvSchema = dataEnvSchema.extend({
  REALTIME_HOST: z.string().min(1).default("0.0.0.0"),
  REALTIME_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type RealtimeEnv = z.infer<typeof realtimeEnvSchema>;

export function parseBaseEnv(env: NodeJS.ProcessEnv = process.env): BaseEnv {
  return baseEnvSchema.parse(env);
}

export function parseApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(env);
}

export function parseWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return workerEnvSchema.parse(env);
}

export function parseRealtimeEnv(env: NodeJS.ProcessEnv = process.env): RealtimeEnv {
  return realtimeEnvSchema.parse(env);
}


export const clerkEnvSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_JWT_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),
  CLERK_AUTHORIZED_PARTIES: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
});

export type ClerkEnv = z.infer<typeof clerkEnvSchema>;

export function parseOptionalClerkEnv(
  env: NodeJS.ProcessEnv = process.env,
): ClerkEnv | null {
  const keys = [
    "CLERK_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "CLERK_JWT_KEY",
    "CLERK_WEBHOOK_SIGNING_SECRET",
    "CLERK_AUTHORIZED_PARTIES",
  ] as const;

  const configured = keys.filter((key) => Boolean(env[key]));
  if (configured.length === 0) return null;

  return clerkEnvSchema.parse(env);
}
