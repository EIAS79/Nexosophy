import { auth } from "@clerk/nextjs/server";
import type { MeResponse } from "@nexosophy/contracts";

const API_URL = process.env.NEXOSOPHY_API_URL ?? "http://127.0.0.1:4000";

export class NexosophyApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "NexosophyApiError";
  }
}

export async function nexosophyApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await auth();

  if (!session.isAuthenticated) {
    throw new NexosophyApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  const token = await session.getToken();
  if (!token) {
    throw new NexosophyApiError(
      401,
      "SESSION_TOKEN_UNAVAILABLE",
      "Session token unavailable.",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(new URL(path, API_URL), {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let code = "API_ERROR";
    let message = `Request failed with status ${response.status}.`;

    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = payload.error?.code ?? code;
      message = payload.error?.message ?? message;
    } catch {
      // Never surface an upstream HTML/error body.
    }

    throw new NexosophyApiError(response.status, code, message);
  }

  return (await response.json()) as T;
}

export function getMe(): Promise<MeResponse> {
  return nexosophyApi<MeResponse>("/v1/me");
}
