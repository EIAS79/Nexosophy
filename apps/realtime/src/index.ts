import { parseRealtimeEnv } from "@nexosophy/config";
import { createLogger } from "@nexosophy/observability";
import Fastify from "fastify";
import { createClient } from "redis";

const env = parseRealtimeEnv();
const logger = createLogger("nexosophy-realtime", env.LOG_LEVEL);
const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (error) => {
  logger.warn({ err: error }, "Realtime Redis connection error");
});

const app = Fastify({ loggerInstance: logger });

app.get("/health", async () => ({
  service: "realtime",
  status: "ok",
  phase: "00",
  timestamp: new Date().toISOString(),
}));

app.get("/ready", async (_request, reply) => {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
    await redis.ping();

    return {
      service: "realtime",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn({ err: error }, "Realtime readiness check failed");
    reply.code(503);

    return {
      service: "realtime",
      status: "unavailable",
      timestamp: new Date().toISOString(),
    };
  }
});

app.get("/v1/realtime/meta", async () => ({
  transport: "reserved-for-phase-08",
  crdt: "yjs-compatible",
  status: "foundation-ready",
}));

app.addHook("onClose", async () => {
  if (redis.isOpen) {
    await redis.quit();
  }
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down realtime service");
  await app.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({
  host: env.REALTIME_HOST,
  port: env.REALTIME_PORT,
});
