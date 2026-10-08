import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";

import { verifyRealtimeRoomToken, type RealtimeRoomTokenClaims } from "@nexosophy/auth";
import { collaborationUpdateSchema, presenceStateSchema } from "@nexosophy/contracts";
import { parseRealtimeEnv } from "@nexosophy/config";
import {
  appendCollaborationUpdate,
  createDatabasePool,
  getCollaborationRoomState,
  getRealtimePermissionState,
} from "@nexosophy/db";
import { createLogger } from "@nexosophy/observability";
import Fastify from "fastify";
import { createClient } from "redis";

import { acceptWebSocket, rejectUpgrade, type WebSocketPeer } from "./websocket.js";

const env = parseRealtimeEnv();
const logger = createLogger("nexosophy-realtime", env.LOG_LEVEL);
const pool = createDatabasePool(env.DATABASE_URL, {
  max: Math.min(env.DB_POOL_MAX, 12),
});
const redis = createClient({ url: env.REDIS_URL });
const publisher = redis.duplicate();
const subscriber = redis.duplicate();
const instanceId =
  (process.env.HOSTNAME ?? "realtime") +
  ":" +
  process.pid +
  ":" +
  randomUUID();

for (const client of [redis, publisher, subscriber]) {
  client.on("error", (error) => {
    logger.warn({ err: error }, "Realtime Redis connection error");
  });
}

type Connection = {
  id: string;
  peer: WebSocketPeer;
  claims: RealtimeRoomTokenClaims;
  roomKey: string;
  channel: string;
  connectedAt: number;
  rateWindowAt: number;
  rateCount: number;
};

const rooms = new Map<string, Map<string, Connection>>();
const connections = new Map<string, Connection>();

function roomKey(workspaceId: string, nodeId: string): string {
  return workspaceId + ":" + nodeId;
}

function roomChannel(workspaceId: string, nodeId: string): string {
  return (
    "nexosophy:room:" +
    encodeURIComponent(workspaceId) +
    ":" +
    encodeURIComponent(nodeId)
  );
}

function localBroadcast(
  key: string,
  payload: unknown,
  excludeConnectionId?: string,
): void {
  for (const connection of rooms.get(key)?.values() ?? []) {
    if (connection.id === excludeConnectionId) continue;
    connection.peer.sendJson(payload);
  }
}

async function distributedBroadcast(
  connection: Connection,
  payload: unknown,
  includeSelf = false,
): Promise<void> {
  localBroadcast(
    connection.roomKey,
    payload,
    includeSelf ? undefined : connection.id,
  );
  await publisher.publish(
    connection.channel,
    JSON.stringify({
      originInstanceId: instanceId,
      excludeConnectionId: includeSelf ? null : connection.id,
      roomKey: connection.roomKey,
      payload,
    }),
  );
}

function parseProtocols(request: IncomingMessage): {
  acceptedProtocol: string;
  token: string;
} | null {
  const header = request.headers["sec-websocket-protocol"];
  if (typeof header !== "string") return null;
  const values = header
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values[0] !== "nexosophy" || !values[1]) return null;
  return { acceptedProtocol: "nexosophy", token: values[1] };
}

async function permissionStillValid(connection: Connection): Promise<boolean> {
  const state = await getRealtimePermissionState(pool, {
    workspaceId: connection.claims.workspaceId,
    nodeId: connection.claims.nodeId,
    userId: connection.claims.userId,
  });
  return (
    state.memberActive &&
    state.nodeActive &&
    state.permissionVersion === connection.claims.permissionVersion &&
    connection.claims.exp > Math.floor(Date.now() / 1000)
  );
}

function consumeRate(connection: Connection): boolean {
  const now = Date.now();
  if (now - connection.rateWindowAt >= 10_000) {
    connection.rateWindowAt = now;
    connection.rateCount = 0;
  }
  connection.rateCount += 1;
  return connection.rateCount <= 200;
}

async function handleMessage(connection: Connection, raw: string): Promise<void> {
  if (!consumeRate(connection)) {
    connection.peer.close(4008, "room message rate exceeded");
    return;
  }

  let message: { type?: unknown; [key: string]: unknown };
  try {
    message = JSON.parse(raw) as { type?: unknown; [key: string]: unknown };
  } catch {
    connection.peer.sendJson({
      type: "error",
      code: "INVALID_MESSAGE",
      message: "Realtime messages must be valid JSON.",
    });
    return;
  }

  if (message.type === "ping") {
    connection.peer.sendJson({ type: "pong", at: Date.now() });
    return;
  }

  if (message.type === "sync") {
    const state = await getCollaborationRoomState(
      pool,
      connection.claims.workspaceId,
      connection.claims.nodeId,
    );
    connection.peer.sendJson({ type: "sync", state, serverTime: Date.now() });
    return;
  }

  if (message.type === "presence") {
    const presence = presenceStateSchema.parse(message.presence ?? {});
    await distributedBroadcast(connection, {
      type: "presence",
      userId: connection.claims.userId,
      connectionId: connection.id,
      presence,
      at: Date.now(),
    });
    return;
  }

  if (message.type === "comment.refresh") {
    if (!connection.claims.capabilities.includes("comment")) {
      connection.peer.sendJson({
        type: "error",
        code: "COMMENT_FORBIDDEN",
        message: "This room token cannot mutate comments.",
      });
      return;
    }
    await distributedBroadcast(
      connection,
      {
        type: "comment.refresh",
        commentId:
          typeof message.commentId === "string" ? message.commentId : null,
        at: Date.now(),
      },
      true,
    );
    return;
  }

  if (message.type !== "update") {
    connection.peer.sendJson({
      type: "error",
      code: "UNKNOWN_MESSAGE_TYPE",
      message: "Unknown realtime message type.",
    });
    return;
  }

  if (!connection.claims.capabilities.includes("write")) {
    connection.peer.sendJson({
      type: "error",
      code: "WRITE_FORBIDDEN",
      message: "This room token is read-only.",
    });
    return;
  }
  if (!(await permissionStillValid(connection))) {
    connection.peer.close(4003, "permission changed");
    return;
  }

  const parsed = collaborationUpdateSchema.parse(message.update);
  const actor = connection.claims.userId + ":" + parsed.clientId;
  const persisted = await appendCollaborationUpdate(pool, {
    workspaceId: connection.claims.workspaceId,
    nodeId: connection.claims.nodeId,
    clientId: parsed.clientId,
    clientClock: parsed.clock,
    registers: parsed.registers.map((register) => ({
      ...register,
      actor,
    })),
    actorUserId: connection.claims.userId,
  });

  connection.peer.sendJson({
    type: "ack",
    clientId: parsed.clientId,
    clock: parsed.clock,
    sequence: persisted.update.sequence,
    duplicate: persisted.duplicate,
  });
  if (!persisted.duplicate) {
    await distributedBroadcast(connection, {
      type: "update",
      update: persisted.update,
    });
  }
}

function removeConnection(connection: Connection): void {
  connections.delete(connection.id);
  const room = rooms.get(connection.roomKey);
  room?.delete(connection.id);
  if (room?.size === 0) rooms.delete(connection.roomKey);
  void distributedBroadcast(connection, {
    type: "presence.leave",
    userId: connection.claims.userId,
    connectionId: connection.id,
    at: Date.now(),
  }).catch(() => undefined);
}

async function authorizeUpgrade(
  request: IncomingMessage,
  socket: Socket,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://realtime.local");
  const match = url.pathname.match(
    /^\/v1\/rooms\/([^/]+)\/([^/]+)\/?$/,
  );
  if (!match) {
    rejectUpgrade(socket, 400, "Unknown realtime room path.");
    return;
  }
  const protocols = parseProtocols(request);
  if (!protocols) {
    rejectUpgrade(socket, 401, "Missing realtime room token.");
    return;
  }

  let claims: RealtimeRoomTokenClaims;
  try {
    claims = verifyRealtimeRoomToken(protocols.token, env.REALTIME_TOKEN_SECRET);
  } catch {
    rejectUpgrade(socket, 401, "Invalid or expired realtime room token.");
    return;
  }

  const workspaceId = decodeURIComponent(match[1]!);
  const nodeId = decodeURIComponent(match[2]!);
  if (claims.workspaceId !== workspaceId || claims.nodeId !== nodeId) {
    rejectUpgrade(socket, 403, "Realtime room token scope mismatch.");
    return;
  }

  const permission = await getRealtimePermissionState(pool, {
    workspaceId,
    nodeId,
    userId: claims.userId,
  });
  if (
    !permission.memberActive ||
    !permission.nodeActive ||
    permission.permissionVersion !== claims.permissionVersion
  ) {
    rejectUpgrade(socket, 403, "Realtime authorization is no longer valid.");
    return;
  }

  const key = roomKey(workspaceId, nodeId);
  const room = rooms.get(key) ?? new Map<string, Connection>();
  if (room.size >= env.REALTIME_MAX_ROOM_CONNECTIONS) {
    rejectUpgrade(socket, 429, "This collaboration room is at capacity.");
    return;
  }

  const peer = acceptWebSocket(
    request,
    socket,
    protocols.acceptedProtocol,
    env.REALTIME_MAX_MESSAGE_BYTES,
  );
  const connection: Connection = {
    id: randomUUID(),
    peer,
    claims,
    roomKey: key,
    channel: roomChannel(workspaceId, nodeId),
    connectedAt: Date.now(),
    rateWindowAt: Date.now(),
    rateCount: 0,
  };
  room.set(connection.id, connection);
  rooms.set(key, room);
  connections.set(connection.id, connection);

  peer.onMessage(async (message) => {
    try {
      await handleMessage(connection, message);
    } catch (error) {
      logger.warn(
        { err: error, roomKey: key, connectionId: connection.id },
        "Realtime message rejected",
      );
      peer.sendJson({
        type: "error",
        code: "MESSAGE_REJECTED",
        message: error instanceof Error ? error.message : "Realtime message rejected.",
      });
    }
  });
  peer.onClose(() => removeConnection(connection));

  const state = await getCollaborationRoomState(pool, workspaceId, nodeId);
  peer.sendJson({
    type: "sync",
    state,
    connectionId: connection.id,
    serverTime: Date.now(),
  });
  await distributedBroadcast(connection, {
    type: "presence.join",
    userId: claims.userId,
    connectionId: connection.id,
    at: Date.now(),
  });
}

await Promise.all([
  redis.connect(),
  publisher.connect(),
  subscriber.connect(),
]);

await subscriber.pSubscribe("nexosophy:room:*", (message) => {
  try {
    const envelope = JSON.parse(message) as {
      originInstanceId?: string;
      excludeConnectionId?: string | null;
      roomKey?: string;
      payload?: unknown;
    };
    if (
      envelope.originInstanceId === instanceId ||
      !envelope.roomKey ||
      envelope.payload === undefined
    ) {
      return;
    }
    localBroadcast(
      envelope.roomKey,
      envelope.payload,
      envelope.excludeConnectionId ?? undefined,
    );
  } catch (error) {
    logger.warn({ err: error }, "Invalid realtime backplane message");
  }
});

const app = Fastify({ loggerInstance: logger });

app.server.on("upgrade", (request, socket) => {
  void authorizeUpgrade(request, socket).catch((error) => {
    logger.warn({ err: error }, "Realtime websocket upgrade failed");
    if (!socket.destroyed) rejectUpgrade(socket, 400, "Realtime upgrade failed.");
  });
});

app.get("/health", async () => ({
  service: "realtime",
  status: "ok",
  phase: "08",
  connections: connections.size,
  rooms: rooms.size,
  timestamp: new Date().toISOString(),
}));

app.get("/ready", async (_request, reply) => {
  try {
    await Promise.all([
      redis.ping(),
      publisher.ping(),
      subscriber.ping(),
      pool.query("select 1"),
    ]);
    return {
      service: "realtime",
      status: "ok",
      connections: connections.size,
      rooms: rooms.size,
      capacity: {
        maxRoomConnections: env.REALTIME_MAX_ROOM_CONNECTIONS,
        maxMessageBytes: env.REALTIME_MAX_MESSAGE_BYTES,
        dbPool: {
          max: Math.min(env.DB_POOL_MAX, 12),
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      },
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
  transport: "websocket",
  protocol: "nexosophy-crdt-v1",
  persistence: "postgres-checkpoints",
  backplane: "redis-pubsub",
  presence: "ephemeral",
  status: "active",
}));

const permissionTimer = setInterval(() => {
  for (const connection of connections.values()) {
    void permissionStillValid(connection)
      .then((valid) => {
        if (!valid) connection.peer.close(4003, "permission changed");
      })
      .catch((error) => {
        logger.warn(
          { err: error, connectionId: connection.id },
          "Realtime permission revalidation failed",
        );
      });
  }
}, 10_000);
permissionTimer.unref();

app.addHook("onClose", async () => {
  clearInterval(permissionTimer);
  for (const connection of connections.values()) {
    connection.peer.close(1001, "server shutdown");
  }
  await subscriber.pUnsubscribe("nexosophy:room:*").catch(() => undefined);
  await Promise.all([
    subscriber.quit(),
    publisher.quit(),
    redis.quit(),
    pool.end(),
  ]);
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
