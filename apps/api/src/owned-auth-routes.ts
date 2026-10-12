import type { FastifyInstance } from "fastify";
import type { NexosophyAuth } from "./owned-auth.js";

const rejectedResponseHeaders = new Set(["transfer-encoding", "connection", "content-length"]);

/**
 * Mount Better Auth on the Fastify API behind the same-origin Next.js proxy.
 * Apple's OAuth callback uses application/x-www-form-urlencoded form_post.
 * Preserve that raw form payload rather than JSON-encoding it.
 */
export function registerOwnedAuthRoutes(
  app: FastifyInstance,
  auth: NexosophyAuth,
  publicAuthUrl: string,
  runtimeEnv: NodeJS.ProcessEnv = process.env,
) {
  const emailSignupAvailable = Boolean(
    runtimeEnv.NEXOSOPHY_EMAIL_API_KEY && runtimeEnv.NEXOSOPHY_EMAIL_FROM,
  );
  const socialProviders = (["google", "github", "facebook", "apple"] as const).filter(
    (provider) => {
      const prefix = provider.toUpperCase();
      return Boolean(runtimeEnv[`${prefix}_CLIENT_ID`] && runtimeEnv[`${prefix}_CLIENT_SECRET`]);
    },
  );
  // Non-secret capability discovery prevents advertising unavailable sign-in methods.
  app.get("/api/auth/capabilities", async (_request, reply) => {
    reply.header("cache-control", "private, no-store");
    return { emailSignupAvailable, socialProviders };
  });

  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_request, body, done) => done(null, body),
    );
  }

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      if (
        !emailSignupAvailable &&
        request.method === "POST" &&
        [
          "/api/auth/sign-up/email",
          "/api/auth/request-password-reset",
          "/api/auth/send-verification-email",
        ].includes(request.url.split("?")[0] ?? "")
      ) {
        return reply.code(503).send({ error: "Authentication email delivery is not configured." });
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (rejectedResponseHeaders.has(key) || key === "host" || value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) {
          headers.append(key, String(item));
        }
      }

      const url = new URL(request.url, publicAuthUrl);
      const formEncoded =
        request.headers["content-type"]
          ?.toLowerCase()
          .startsWith("application/x-www-form-urlencoded") && typeof request.body === "string";
      const body =
        request.body === undefined
          ? undefined
          : formEncoded
            ? (request.body as string)
            : JSON.stringify(request.body);
      const browserRequest = new Request(url, {
        method: request.method,
        headers,
        ...(body !== undefined && request.method !== "GET" ? { body } : {}),
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
