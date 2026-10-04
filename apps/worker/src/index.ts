import { parseWorkerEnv } from "@nexosophy/config";
import { createLogger } from "@nexosophy/observability";
import { Worker } from "bullmq";
import Fastify from "fastify";

const env = parseWorkerEnv();
const logger = createLogger("nexosophy-worker", env.LOG_LEVEL);
const redisUrl = new URL(env.REDIS_URL);

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

const health = Fastify({ loggerInstance: logger });

health.get("/health", async () => ({
  service: "worker",
  status: "ok",
  timestamp: new Date().toISOString(),
}));

health.get("/ready", async (_request, reply) => {
  try {
    await worker.waitUntilReady();
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
  await health.close();
  await worker.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await health.listen({
  host: env.WORKER_HEALTH_HOST,
  port: env.WORKER_HEALTH_PORT,
});

logger.info({ concurrency: env.WORKER_CONCURRENCY }, "Worker started");
