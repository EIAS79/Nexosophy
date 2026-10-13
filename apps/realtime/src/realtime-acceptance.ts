/** Real socket acceptance against two local Nexosophy realtime replicas and
 * one disposable PostgreSQL/Redis stack. No cloud services or domain required.
 */
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import assert from "node:assert/strict";
import { createDatabasePool } from "@nexosophy/db";
import { createRealtimeRoomToken } from "@nexosophy/auth";

const databaseURL = process.env.DATABASE_URL ?? "";
const redisURL = process.env.REDIS_URL ?? "";
if (!databaseURL.includes("127.0.0.1:5432") || !redisURL.includes("127.0.0.1:6379") ||
    process.env.APP_ENV !== "local" || process.env.NODE_ENV !== "test") {
  throw new Error("Refusing realtime acceptance outside disposable local CI.");
}
const secret = "realtime-local-only-secret-for-integration-test-2026";
const pool = createDatabasePool(databaseURL, { max: 3 });
const children: ChildProcess[] = [];
type Envelope = Record<string, unknown>;
type SocketInbox = {
  socket: WebSocket;
  next: (type: string, predicate?: (x: Envelope) => boolean) => Promise<Envelope>;
};

async function startup(port: number) {
  const child = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      REALTIME_HOST: "127.0.0.1",
      REALTIME_PORT: String(port),
      REALTIME_PUBLIC_URL: `ws://127.0.0.1:${port}`,
      REALTIME_TOKEN_SECRET: secret,
    },
  });
  children.push(child);
  let diagnostic = "";
  for (const stream of [child.stdout, child.stderr])
    stream?.on("data", (chunk: Buffer) => { diagnostic = (diagnostic + chunk.toString()).slice(-3500); });
  for (let attempts = 0; attempts < 80; attempts++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ready`, { signal: AbortSignal.timeout(750) });
      if (response.ok) return;
    } catch { /* still starting */ }
    await sleep(150);
  }
  throw new Error(`Realtime replica on ${port} failed readiness: ${diagnostic}`);
}

async function socketInbox(url: string, token: string): Promise<SocketInbox> {
  const socket = new WebSocket(url, ["nexosophy", token]);
  const backlog: Envelope[] = [];
  const listeners: Array<{ type: string; check: (x: Envelope) => boolean; settle: (x: Envelope) => void }> = [];
  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as Envelope;
      const index = listeners.findIndex((entry) => entry.type === payload.type && entry.check(payload));
      if (index >= 0) listeners.splice(index, 1)[0]!.settle(payload);
      else backlog.push(payload);
    } catch { /* invalid messages are an assertion failure when awaited */ }
  });
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("WebSocket failed handshake")), { once: true });
    }),
    sleep(6000).then(() => { throw new Error("WebSocket handshake timed out"); }),
  ]);
  return {
    socket,
    next(type, predicate = () => true) {
      const index = backlog.findIndex((x) => x.type === type && predicate(x));
      if (index >= 0) return Promise.resolve(backlog.splice(index, 1)[0]!);
      return new Promise<Envelope>((resolve, reject) => {
        const entry = { type, check: predicate, settle: resolve };
        listeners.push(entry);
        setTimeout(() => {
          const pending = listeners.indexOf(entry);
          if (pending >= 0) {
            listeners.splice(pending, 1);
            reject(new Error("Timeout waiting for " + type));
          }
        }, 6000).unref();
      });
    },
  };
}

function token(workspaceId: string, nodeId: string, userId: string, capabilities: Array<"read" | "write" | "comment">, version = 1) {
  return createRealtimeRoomToken({
    v: 1, workspaceId, nodeId, userId,
    permissionVersion: version,
    capabilities, exp: Math.floor(Date.now() / 1000) + 180,
    nonce: randomUUID(),
  }, secret);
}

try {
  const own = (await pool.query<{ id: string }>(`insert into "users" ("status") values ('active') returning "id"`)).rows[0]!.id;
  const colleague = (await pool.query<{ id: string }>(`insert into "users" ("status") values ('active') returning "id"`)).rows[0]!.id;
  const outsider = (await pool.query<{ id: string }>(`insert into "users" ("status") values ('active') returning "id"`)).rows[0]!.id;
  const workspace = (await pool.query<{ id: string }>(
    `insert into "workspaces" ("type","owner_user_id","name","slug")
     values ('team',$1,'Realtime acceptance',$2) returning "id"`,
    [own, "realtime-" + randomUUID().replaceAll("-", "").slice(0, 20)],
  )).rows[0]!.id;
  await pool.query(
    `insert into "workspace_members" ("workspace_id","user_id","role","status")
     values ($1,$2,'owner','active'),($1,$3,'member','active')`,
    [workspace, own, colleague],
  );
  const node = (await pool.query<{ id: string }>(
    `insert into "content_nodes" ("workspace_id","kind","name","created_by_user_id","updated_by_user_id")
     values ($1,'document','Shared realtime test',$2,$2) returning "id"`, [workspace, own],
  )).rows[0]!.id;
  await Promise.all([startup(4110), startup(4111)]);
  const base = `/v1/rooms/${workspace}/${node}`;
  const first = await socketInbox("ws://127.0.0.1:4110" + base, token(workspace,node,own,["read","write","comment"]));
  const second = await socketInbox("ws://127.0.0.1:4111" + base, token(workspace,node,colleague,["read","write","comment"]));
  assert.equal((await first.next("sync")).state !== undefined, true);
  await second.next("sync");
  const update = {
    clientId:"replica-" + randomUUID(), clock:1,
    registers:[{ key:"test.acceptance", value:"from peer A", deleted:false, lamport:1, actor:own }],
  };
  first.socket.send(JSON.stringify({ type:"update", update }));
  const ack = await first.next("ack", x => x.clientId === update.clientId);
  assert.equal(ack.duplicate, false);
  const propagated = await second.next("update", x => (x.update as Envelope)?.clientId === update.clientId);
  assert.equal((propagated.update as Envelope).clientId, update.clientId);
  first.socket.send(JSON.stringify({ type:"update", update }));
  assert.equal((await first.next("ack", x=>x.clientId===update.clientId)).duplicate, true);
  const readOnly = await socketInbox("ws://127.0.0.1:4110" + base, token(workspace,node,own,["read"]));
  await readOnly.next("sync");
  readOnly.socket.send(JSON.stringify({ type:"update", update:{ ...update, clientId:"readonly" } }));
  assert.equal((await readOnly.next("error")).code, "WRITE_FORBIDDEN");
  readOnly.socket.close();

  // A forged token with valid HMAC but a nonmember identity must not connect.
  const unauthorized = new WebSocket("ws://127.0.0.1:4111" + base, [
    "nexosophy", token(workspace,node,outsider,["read","write"]),
  ]);
  await Promise.race([
    new Promise<void>((resolve,reject) => {
      unauthorized.addEventListener("error", () => resolve(), { once: true });
      unauthorized.addEventListener("open", () => reject(new Error("Foreign account joined room")));
    }),
    sleep(6000).then(()=>{ throw new Error("Nonmember room authorization timed out"); }),
  ]);
  unauthorized.close();

  // Suspend the current member and bump room capability version atomically.
  await pool.query("begin");
  try {
    await pool.query(`update "workspace_members" set "status"='suspended'
                     where "workspace_id"=$1 and "user_id"=$2`, [workspace, colleague]);
    await pool.query(`update "workspaces" set "permission_version"="permission_version"+1
                     where "id"=$1`, [workspace]);
    await pool.query("commit");
  } catch (e) { await pool.query("rollback"); throw e; }
  const kicked = new Promise<number>((resolve,reject) => {
    second.socket.addEventListener("close", event => resolve(event.code), { once: true });
    second.socket.addEventListener("error", ()=>reject(new Error("Unexpected websocket transport error")), { once: true });
    setTimeout(()=>reject(new Error("Suspended member remained connected")),6000).unref();
  });
  second.socket.send(JSON.stringify({ type:"sync" }));
  assert.equal(await kicked,4003);
  first.socket.send(JSON.stringify({ type:"sync" }));
  const firstClose = await new Promise<number>((resolve,reject)=>{
    first.socket.addEventListener("close", event => resolve(event.code),{once:true});
    setTimeout(()=>reject(new Error("Permission-version change not enforced")),6000).unref();
  });
  assert.equal(firstClose,4003);
  console.log("PASS two real realtime replicas, Redis cross-replica update, idempotence, read-only denial, outsider exclusion, and permission revocation.");
} finally {
  for (const child of children) child.kill("SIGTERM");
  await pool.end();
}
