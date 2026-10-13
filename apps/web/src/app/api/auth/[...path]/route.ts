import type { NextRequest } from "next/server";

const backend = process.env.NEXOSOPHY_API_URL ?? "http://127.0.0.1:4000";

async function proxyAuthentication(request: NextRequest) {
  if (
    (process.env.APP_ENV === "staging" || process.env.APP_ENV === "production") &&
    !process.env.NEXOSOPHY_API_URL
  ) {
    return Response.json({ error: "Authentication service unavailable." }, { status: 503 });
  }

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, backend);
  const headers = new Headers(request.headers);
  for (const key of ["host", "connection", "content-length", "transfer-encoding"]) {
    headers.delete(key);
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      ...(request.method === "POST" ? { body: await request.arrayBuffer() } : {}),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const returnedHeaders = new Headers(response.headers);
    for (const key of ["connection", "transfer-encoding", "content-length"]) {
      returnedHeaders.delete(key);
    }
    // Never let a shared CDN or intermediary cache an authenticated response.
    returnedHeaders.set("cache-control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      headers: returnedHeaders,
    });
  } catch {
    return Response.json(
      { error: "Authentication service is temporarily unavailable." },
      { status: 503 },
    );
  }
}

export const GET = proxyAuthentication;
export const POST = proxyAuthentication;
