import { randomUUID } from "node:crypto";

import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { AuthVerifier, IdentityProvider, IdentityStorePort } from "@nexosophy/auth";
import { parseOptionalStorageEnv, type ApiEnv } from "@nexosophy/config";
import { healthResponseSchema } from "@nexosophy/contracts";
import { createDatabasePool } from "@nexosophy/db";
import { createLoggerOptions } from "@nexosophy/observability";
import { S3CompatibleStorageAdapter, type StorageAdapter } from "@nexosophy/storage";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { createClient } from "redis";

import { installApiPlatform } from "./api-platform.js";
import { registerAssetRoutes } from "./asset-routes.js";
import { createAuthRuntime } from "./auth-runtime.js";
import { registerClerkWebhookRoute } from "./clerk-webhook.js";
import { registerCollaborationRoutes } from "./collaboration-routes.js";
import { registerContentRoutes } from "./content-routes.js";
import { registerEditorRoutes } from "./editor-routes.js";
import { registerHistoryRoutes } from "./history-routes.js";
import { registerIdentityRoutes } from "./identity-routes.js";
import { registerJobRoutes } from "./job-routes.js";
import { registerProductivityRoutes } from "./productivity-routes.js";
import { registerSearchRoutes } from "./search-routes.js";
import { registerSpatialRoutes } from "./spatial-routes.js";
import { registerWorkspaceRoutes } from "./workspace-routes.js";

const serviceVersion = process.env.npm_package_version ?? "0.0.0";

export type BuildAppOptions = {
  authVerifier?: AuthVerifier;
  identityProvider?: IdentityProvider;
  identityStore?: IdentityStorePort;
  storageAdapter?: StorageAdapter | null;
};

export async function buildApp(
  env: ApiEnv,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: createLoggerOptions("nexosophy-api", env.LOG_LEVEL),
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      return typeof incoming === "string" && incoming.length <= 128 ? incoming : randomUUID();
    },
  });

  const pool = createDatabasePool(env.DATABASE_URL, { max: env.DB_POOL_MAX });
  const redis = createClient({ url: env.REDIS_URL });
  installApiPlatform(app, redis);

  redis.on("error", (error) => {
    app.log.warn({ err: error }, "Redis connection error");
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Nexosophy API",
        description: "Typed API for the Nexosophy knowledge workspace.",
        version: serviceVersion,
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found.",
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode =
      typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    const validationError = Array.isArray(error.validation);
    const code = validationError
      ? "VALIDATION_ERROR"
      : statusCode >= 500
        ? "INTERNAL_ERROR"
        : "REQUEST_ERROR";

    if (statusCode >= 500) {
      request.log.error({ err: error }, "Unhandled API error");
    } else {
      request.log.warn({ err: error }, "API request failed");
    }

    reply.code(statusCode).send({
      error: {
        code,
        message:
          statusCode >= 500
            ? "An unexpected server error occurred."
            : validationError
              ? "The request failed validation."
              : error.message,
        requestId: request.id,
      },
    });
  });

  const runtime =
    options.authVerifier || options.identityProvider || options.identityStore
      ? {
          verifier: options.authVerifier,
          provider: options.identityProvider,
          identityStore: options.identityStore,
        }
      : createAuthRuntime(env, pool);

  const storageEnv = parseOptionalStorageEnv();
  const storage =
    options.storageAdapter !== undefined
      ? options.storageAdapter
      : storageEnv
        ? new S3CompatibleStorageAdapter({
            endpoint: storageEnv.S3_ENDPOINT,
            region: storageEnv.S3_REGION,
            bucket: storageEnv.S3_BUCKET,
            accessKeyId: storageEnv.S3_ACCESS_KEY_ID,
            secretAccessKey: storageEnv.S3_SECRET_ACCESS_KEY,
            sessionToken: storageEnv.S3_SESSION_TOKEN,
          })
        : null;

  await registerIdentityRoutes(app, pool, runtime.verifier);
  await registerWorkspaceRoutes(app, pool, runtime.verifier);
  await registerContentRoutes(app, pool, runtime.verifier);
  await registerCollaborationRoutes(app, pool, runtime.verifier);
  await registerAssetRoutes(app, pool, storage, runtime.verifier);
  await registerEditorRoutes(app, pool, runtime.verifier);
  await registerHistoryRoutes(app, pool, runtime.verifier);
  await registerJobRoutes(app, pool, runtime.verifier);
  await registerSpatialRoutes(app, pool, runtime.verifier);
  await registerSearchRoutes(app, pool, runtime.verifier);
  await registerProductivityRoutes(app, pool, runtime.verifier);

  if (runtime.provider && runtime.identityStore) {
    await registerClerkWebhookRoute(app, pool, runtime.provider, runtime.identityStore);
  }

  app.get("/health", async (request) => {
    return healthResponseSchema.parse({
      service: "api",
      status: "ok",
      version: serviceVersion,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  });

  app.get("/ready", async (request, reply) => {
    const checks: Record<string, "ok" | "unavailable"> = {
      postgres: "unavailable",
      redis: "unavailable",
    };

    try {
      await pool.query("select 1");
      checks.postgres = "ok";
    } catch (error) {
      request.log.warn({ err: error }, "PostgreSQL readiness check failed");
    }

    try {
      if (!redis.isOpen) {
        await redis.connect();
      }
      await redis.ping();
      checks.redis = "ok";
    } catch (error) {
      request.log.warn({ err: error }, "Redis readiness check failed");
    }

    const ready = Object.values(checks).every((status) => status === "ok");
    if (!ready) {
      reply.code(503);
    }

    return {
      service: "api",
      status: ready ? "ok" : "unavailable",
      version: serviceVersion,
      timestamp: new Date().toISOString(),
      requestId: request.id,
      dependencies: checks,
      capacity: {
        dbPool: {
          max: env.DB_POOL_MAX,
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      },
    };
  });

  app.get("/openapi.json", async () => app.swagger());

  app.get("/v1/meta", async (request) => ({
    name: "Nexosophy",
    apiVersion: "v1",
    requestId: request.id,
  }));

  app.addHook("onClose", async () => {
    if (redis.isOpen) {
      await redis.quit();
    }
    await pool.end();
  });

  return app;
}