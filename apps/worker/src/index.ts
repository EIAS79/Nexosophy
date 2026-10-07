import { parseWorkerEnv } from "@nexosophy/config";
import {
  claimNextContentOperation,
  ContentStoreError,
  createDatabasePool,
  failContentOperation,
  processContentOperationBatch,
} from "@nexosophy/db";
import { createLogger } from "@nexosophy/observability";
import { Worker } from "bullmq";
import Fastify from "fastify";

const env = parseWorkerEnv();
const logger = createLogger("nexosophy-worker", env.LOG_LEVEL);
const redisUrl = new URL(env.REDIS_URL);
const contentPool = createDatabasePool(env.DATABASE_URL, {
  max: Math.min(Math.max(env.WORKER_CONCURRENCY + 2, 4), 12),
});
const workerId = `${process.env.HOSTNAME ?? "worker"}:${process.pid}`;
let stopping = false;

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
  ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
};

const worker = new Worker(
  "nexosophy-system",
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "Processing system job");
    return { ok: true };
  },
  {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
  },
);

worker.on("error", (error) => {
  logger.error({ err: error }, "Worker error");
});

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function permanentContentFailure(error: unknown): boolean {
  return (
    error instanceof ContentStoreError &&
    new Set([
      "NAME_CONFLICT",
      "NODE_NOT_FOUND",
      "PARENT_NOT_FOUND",
      "PARENT_NOT_FOLDER",
      "TARGET_NOT_FOUND",
      "CYCLE",
      "OPERATION_CANCELLED",
    ]).has(error.code)
  );
}

async function runContentOperationLoop(): Promise<void> {
  while (!stopping) {
    let operationId: string | null = null;
    try {
      const claimed = await claimNextContentOperation(contentPool, workerId);
      if (!claimed) {
        await delay(500);
        continue;
      }

      operationId = claimed.id;
      logger.info(
        {
          operationId: claimed.id,
          operation: claimed.operation,
          totalNodes: claimed.totalNodes,
          attempt: claimed.attempts,
        },
        "Processing content operation",
      );

      let current = claimed;
      while (!stopping && current.status === "running") {
        current = await processContentOperationBatch(contentPool, current.id);
      }

      if (current.status === "succeeded") {
        logger.info(
          {
            operationId: current.id,
            operation: current.operation,
            processedNodes: current.processedNodes,
          },
          "Content operation completed",
        );
      }
    } catch (error) {
      logger.error({ err: error, operationId }, "Content operation batch failed");
      if (operationId) {
        await failContentOperation(contentPool, operationId, {
          code: error instanceof ContentStoreError ? error.code : "CONTENT_OPERATION_FAILED",
          message: error instanceof Error ? error.message : "Unknown content operation failure.",
          retryable: !permanentContentFailure(error),
        });
      }
      await delay(250);
    }
  }
}

const contentLoop = runContentOperationLoop();
const health = Fastify({ loggerInstance: logger });

health.get("/health", async () => ({
  service: "worker",
  status: "ok",
  timestamp: new Date().toISOString(),
}));

health.get("/ready", async (_request, reply) => {
  try {
    await Promise.all([worker.waitUntilReady(), contentPool.query("select 1")]);
    return {
      service: "worker",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn({ err: error }, "Worker readiness check failed");
    reply.code(503);
    return {
      service: "worker",
      status: "unavailable",
      timestamp: new Date().toISOString(),
    };
  }
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker");
  stopping = true;
  await health.close();
  await worker.close();
  await contentLoop;
  await contentPool.end();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await health.listen({
  host: env.WORKER_HEALTH_HOST,
  port: env.WORKER_HEALTH_PORT,
});

logger.info(
  {
    concurrency: env.WORKER_CONCURRENCY,
    contentBatchSize: 200,
  },
  "Worker started",
);