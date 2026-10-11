import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerOwnedAuthRoutes } from "./owned-auth-routes.js";
import type { NexosophyAuth } from "./owned-auth.js";

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("owned authentication Fastify transport", () => {
  it("preserves JSON sign-in requests and distinct Set-Cookie headers", async () => {
    let received: Request | undefined;
    const auth = {
      async handler(request: Request) {
        received = request;
        const headers = new Headers({ "content-type": "application/json" });
        headers.append("set-cookie", "nexosophy.session_token=first; HttpOnly; Path=/");
        headers.append("set-cookie", "nexosophy.csrf_token=second; HttpOnly; Path=/");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      },
    } as NexosophyAuth;
    const app = Fastify();
    apps.push(app);
    registerOwnedAuthRoutes(app, auth, "https://nexosophy.example");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin: "https://nexosophy.example", "content-type": "application/json" },
      payload: { email: "a@example.net", password: "a-long-password" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(received?.url).toBe("https://nexosophy.example/api/auth/sign-in/email");
    expect(received?.headers.get("origin")).toBe("https://nexosophy.example");
    expect(await received?.json()).toMatchObject({ email: "a@example.net" });
    const cookies = response.headers["set-cookie"];
    expect(Array.isArray(cookies)).toBe(true);
    expect(cookies).toHaveLength(2);
    expect(cookies?.[0]).toContain("nexosophy.session_token=first");
    expect(cookies?.[1]).toContain("nexosophy.csrf_token=second");
  });

  it("accepts Apple form_post and preserves OAuth state, code and content type", async () => {
    let received: Request | undefined;
    const auth = {
      async handler(request: Request) {
        received = request;
        return new Response(null, { status: 204 });
      },
    } as NexosophyAuth;
    const app = Fastify();
    apps.push(app);
    registerOwnedAuthRoutes(app, auth, "https://nexosophy.example");

    const payload = "code=auth%2Bcode&state=nonce%3D123&id_token=signed.jwt";
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/callback/apple",
      headers: {
        origin: "https://appleid.apple.com",
        "content-type": "application/x-www-form-urlencoded",
      },
      payload,
    });

    expect(response.statusCode).toBe(204);
    expect(received?.url).toBe("https://nexosophy.example/api/auth/callback/apple");
    expect(received?.headers.get("content-type")).toContain("application/x-www-form-urlencoded");
    expect(await received?.text()).toBe(payload);
  });

  it("does not introduce a form-urlencoded parser for arbitrary multipart payloads", async () => {
    const auth = {
      handler: async (_request: Request) => new Response(null, { status: 204 }),
    } as unknown as NexosophyAuth;
    const app = Fastify();
    apps.push(app);
    registerOwnedAuthRoutes(app, auth, "https://nexosophy.example");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/callback/apple",
      headers: { "content-type": "multipart/form-data; boundary=untrusted" },
      payload: "not-a-multipart-body",
    });
    expect(response.statusCode).toBe(415);
  });
});
