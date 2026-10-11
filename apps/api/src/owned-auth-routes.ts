import type { FastifyInstance } from "fastify";
import type { NexosophyAuth } from "./owned-auth.js";

const rejectedResponseHeaders = new Set(["transfer-encoding", "connection", "content-length"]);

/**
 * Better Auth's Web-standard Request/Response adapter for Fastify. Must be
 * deployed behind the same-origin Next.js proxy so auth cookies stay first party.
 */
export function registerOwnedAuthRoutes(
  app: FastifyInstance,
  auth: NexosophyAuth,
  publicAuthUrl: string,
) {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (rejectedResponseHeaders.has(key) || value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) {
          headers.append(key, String(item));
        }
      }

      const url = new URL(request.url, publicAuthUrl);
      const body = request.body === undefined ? undefined : JSON.stringify(request.body);
      const browserRequest = new Request(url, {
        method: request.method,
        headers,
        ...(body && request.method !== "GET" ? { body } : {}),
      });

      const response = await auth.handler(browserRequest);
      for (const [key, value] of response.headers) {
        if (key === "set-cookie" || rejectedResponseHeaders.has(key)) continue;
        reply.header(key, value);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);
      reply.code(response.status);
      return reply.send(Buffer.from(await response.arrayBuffer()));
    },
  });
}
