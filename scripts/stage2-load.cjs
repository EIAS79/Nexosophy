/* Stage-2 bounded local HTTP load acceptance. Never target a public host.
 * Makes 180 real session-backed requests via the Next -> API -> PostgreSQL path.
 */
const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");

const base = "http://localhost:3000";
if (process.env.NODE_ENV !== "test" || process.env.APP_ENV !== "local" ||
    process.env.AUTH_LOCAL_E2E !== "1" || !process.env.AUTH_TEST_PASSWORD) {
  throw new Error("Refusing to run Stage 2 load tests outside local disposable CI");
}

async function timedRequest(path, headers = {}) {
  const start = performance.now();
  const response = await fetch(base + path, {
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  const content = await response.text();
  return { status: response.status, duration: performance.now() - start, content };
}

async function runLoad(label, path, total, concurrency, headers, check) {
  const durations = [];
  const failures = [];
  const statusCounts = new Map();
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < total) {
      const task = next++;
      try {
        const response = await timedRequest(path, headers);
        durations.push(response.duration);
        statusCounts.set(response.status, (statusCounts.get(response.status) ?? 0) + 1);
        check(response, task);
      } catch (error) {
        failures.push(String(error));
      }
    }
  });
  await Promise.all(workers);
  durations.sort((a, b) => a - b);
  assert.equal(failures.length, 0, label + " failures: " + failures.slice(0, 3).join("; "));
  assert.equal(durations.length, total);
  const p95 = durations[Math.ceil(total * .95) - 1];
  assert.ok(p95 < 8000, label + " p95 too high: " + p95.toFixed(0) + " ms");
  console.log("PASS " + label + " " + total + " req / " + concurrency +
    " concurrency / p95=" + p95.toFixed(0) + "ms");
  return statusCounts;
}

(async () => {
  const signIn = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({
      email: "first@local.nexosophy.test",
      password: process.env.AUTH_TEST_PASSWORD,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(signIn.status, 200, "Local account must sign in");
  const rawCookie = signIn.headers.get("set-cookie");
  assert.ok(rawCookie, "Authenticated session should provide a session cookie");
  const cookie = rawCookie.split(";")[0];
  assert.ok(cookie && cookie.includes("="));
  const result = await timedRequest("/api/auth/get-session", { cookie });
  assert.equal(result.status, 200);
  assert.ok(JSON.parse(result.content)?.session?.id, "Session must resolve through Next proxy");

  await runLoad("regular authenticated session checks", "/api/auth/get-session", 20, 5,
    { cookie }, (response) => {
      assert.equal(response.status, 200);
      assert.ok(JSON.parse(response.content)?.session?.id);
    });

  const burst = await runLoad("session rate-limit burst", "/api/auth/get-session", 180, 18,
    { cookie }, (response) => {
      assert.ok(response.status === 200 || response.status === 429,
        "Rate limit must protect the session API without 5xx responses; got " + response.status);
      if (response.status === 200)
        assert.ok(JSON.parse(response.content)?.session?.id);
    });
  assert.ok((burst.get(429) ?? 0) > 0,
    "Excessive session requests must activate HTTP 429 rate limiting");

  await runLoad("anonymous route protection", "/app", 90, 15,
    {}, (response) => {
      // fetch follows Next redirects automatically: the anonymous user ends at /login.
      assert.equal(response.status, 200);
      assert.ok(response.content.includes("Sign in"));
    });

  await runLoad("marketing shell", "/", 60, 12,
    {}, (response) => {
      assert.equal(response.status, 200);
      assert.ok(response.content.includes("Nexosophy"));
    });

  console.log("PASS Stage 2 domain-free bounded API/shell load acceptance");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
