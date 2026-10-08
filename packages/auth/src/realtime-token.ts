import { createHmac, timingSafeEqual } from "node:crypto";

export type RealtimeRoomTokenClaims = {
  v: 1;
  workspaceId: string;
  nodeId: string;
  userId: string;
  permissionVersion: number;
  capabilities: Array<"read" | "write" | "comment">;
  exp: number;
  nonce: string;
};

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createRealtimeRoomToken(
  claims: RealtimeRoomTokenClaims,
  secret: string,
): string {
  if (secret.length < 32) throw new Error("Realtime token secret must be at least 32 characters.");
  const header = encode({ alg: "HS256", typ: "NEXO-RT" });
  const body = encode(claims);
  const payload = header + "." + body;
  return payload + "." + sign(payload, secret);
}

export function verifyRealtimeRoomToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): RealtimeRoomTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("INVALID_REALTIME_TOKEN");
  const [header, body, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(header + "." + body, secret), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("INVALID_REALTIME_TOKEN");
  }
  const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as {
    alg?: string;
    typ?: string;
  };
  if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "NEXO-RT") {
    throw new Error("INVALID_REALTIME_TOKEN");
  }
  const claims = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as RealtimeRoomTokenClaims;
  if (
    claims.v !== 1 ||
    !claims.workspaceId ||
    !claims.nodeId ||
    !claims.userId ||
    !Number.isInteger(claims.permissionVersion) ||
    !Array.isArray(claims.capabilities) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= nowSeconds
  ) {
    throw new Error("EXPIRED_OR_INVALID_REALTIME_TOKEN");
  }
  return claims;
}
