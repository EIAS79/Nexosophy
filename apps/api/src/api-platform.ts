import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RedisClientType } from "redis";

type EndpointClass = "read" | "write" | "upload" | "expensive";

const RATE_LIMITS: Record<
  EndpointClass,
  { limit: number; windowSeconds: number; concurrency: number; failClosed: boolean }
> = {
  read: { limit: 360, windowSeconds: 60, concurrency: 0, failClosed: false },
  write: { limit: 180, windowSeconds: 60, concurrency: 0, failClosed: false },
  upload: { limit: 45, windowSeconds: 60, concurrency: 8, failClosed: true },
  expensive: { limit: 30, windowSeconds: 60, concurrency: 4, failClosed: true },
};

function classify(request: FastifyRequest): EndpointClass {
  const path = request.url.split("?")[0] ?? request.url;
  if (path.includes("/uploads/") || path.endsWith("/uploads/initiate")) return "upload";
  if (
    path.includes("/exports") ||
    path.includes("/imports") ||
    path.includes("/search") ||
    path.includes("/ai/")
  ) {
    return "expensive";
  }
  return request.method === "GET" || request.method === "HEAD" ? "read" : "write";
}

function clientKey(request: FastifyRequest): string {
  const auth = request.headers.authorization;
  const tokenHint =
    typeof auth === "string" && auth.length > 16
      ? auth.slice(-16).replace(/[^a-zA-Z0-9]/g, "")
      : "anonymous";
  return request.ip + ":" + tokenHint;
}

async function ensureRedis(redis: RedisClientType): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

const RATE_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {current, ttl}
`;

export function installApiPlatform(
  app: FastifyInstance,
  redis: RedisClientType,
): void {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/")) return;

    const endpointClass = classify(request);
    const policy = RATE_LIMITS[endpointClass];
    const subject = clientKey(request);
    const bucket = Math.floor(Date.now() / (policy.windowSeconds * 1000));
    const key = ["nexosophy", "rate", endpointClass, subject, bucket].join(":");

    try {
      await ensureRedis(redis);
      const result = (await redis.eval(RATE_LUA, {
        keys: [key],
        arguments: [String(policy.windowSeconds + 2)],
      })) as [number, number];
      const count = Number(result?.[0] ?? 0);
      const ttl = Math.max(1, Number(result?.[1] ?? policy.windowSeconds));
      reply.header("X-RateLimit-Limit", String(policy.limit));
      reply.header("X-RateLimit-Remaining", String(Math.max(0, policy.limit - count)));
      if (count > policy.limit) {
        reply.header("Retry-After", String(ttl));
        return reply.code(429).send({
          error: {
            code: "RATE_LIMITED",
            message: "Request rate exceeded. Retry after the indicated delay.",
            requestId: request.id,
            retryAfter: ttl,
          },
        });
      }

      if (policy.concurrency > 0) {
        const concurrencyKey = ["nexosophy", "concurrency", endpointClass, subject].join(":");
        const current = await redis.incr(concurrencyKey);
        if (current === 1) await redis.expire(concurrencyKey, 30);
        if (current > policy.concurrency) {
          await redis.decr(concurrencyKey);
          reply.header("Retry-After", "2");
          return reply.code(503).send({
            error: {
              code: "BACKPRESSURE",
              message: "This operation class is temporarily saturated. Retry shortly.",
              requestId: request.id,
            },
          });
        }

        let released = false;
        const release = async () => {
          if (released || !redis.isOpen) return;
          released = true;
          try {
            const remaining = await redis.decr(concurrencyKey);
            if (remaining <= 0) await redis.del(concurrencyKey);
          } catch {
            // TTL is the safety net if a release cannot be recorded.
          }
        };
        reply.raw.once("finish", () => void release());
        reply.raw.once("close", () => void release());
      }
    } catch (error) {
      request.log.warn({ err: error, endpointClass }, "Shared admission control unavailable");
      if (policy.failClosed) {
        return reply.code(503).send({
          error: {
            code: "ADMISSION_CONTROL_UNAVAILABLE",
            message: "Shared admission control is temporarily unavailable.",
            requestId: request.id,
          },
        });
      }
    }
  });
}

export function idempotencyKey(request: FastifyRequest): string | undefined {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 200 ? normalized : undefined;
}

export function requireIdempotencyKey(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const key = idempotencyKey(request);
  if (key) return key;
  reply.code(400).send({
    error: {
      code: "IDEMPOTENCY_KEY_REQUIRED",
      message: "This mutation requires an Idempotency-Key header.",
      requestId: request.id,
    },
  });
  return null;
}
