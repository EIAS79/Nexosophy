"use client";

import type {
  CollaborationSnapshot,
  CollaborationUpdate,
  CrdtRegister,
  PresenceState,
} from "@nexosophy/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type TokenResponse = {
  token: string;
  websocketUrl: string;
  expiresAt: string;
  permissionVersion: number;
  capabilities: Array<"read" | "write" | "comment">;
};

type PresenceEntry = {
  userId: string;
  connectionId: string;
  presence: PresenceState;
};

type QueuedUpdate = {
  clientId: string;
  clock: number;
  registers: CrdtRegister[];
};

type RealtimeRoomContextValue = {
  status: "connecting" | "connected" | "offline" | "denied";
  capabilities: readonly string[];
  registers: Readonly<Record<string, CrdtRegister>>;
  presence: Readonly<Record<string, PresenceEntry>>;
  sendUpdate: (registers: Array<Omit<CrdtRegister, "actor">>) => void;
  sendPresence: (presence: PresenceState) => void;
  notifyCommentRefresh: (commentId?: string) => void;
};

const RealtimeRoomContext = createContext<RealtimeRoomContextValue | null>(null);

function wins(next: CrdtRegister, current?: CrdtRegister): boolean {
  if (!current) return true;
  if (next.lamport !== current.lamport) return next.lamport > current.lamport;
  return next.actor.localeCompare(current.actor) > 0;
}

function mergeRegisters(
  current: Record<string, CrdtRegister>,
  incoming: readonly CrdtRegister[],
): Record<string, CrdtRegister> {
  let changed = false;
  const next = { ...current };
  for (const register of incoming) {
    if (wins(register, next[register.key])) {
      next[register.key] = register;
      changed = true;
    }
  }
  return changed ? next : current;
}

function queueKey(workspaceId: string, nodeId: string): string {
  return `nexosophy:realtime-queue:${workspaceId}:${nodeId}`;
}

function clientKey(workspaceId: string): string {
  return `nexosophy:realtime-client:${workspaceId}`;
}

function clockKey(workspaceId: string, nodeId: string): string {
  return `nexosophy:realtime-clock:${workspaceId}:${nodeId}`;
}

export function RealtimeRoomProvider({
  workspaceId,
  nodeId,
  children,
}: {
  workspaceId: string;
  nodeId: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<RealtimeRoomContextValue["status"]>("connecting");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [registers, setRegisters] = useState<Record<string, CrdtRegister>>({});
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const stopped = useRef(false);
  const reconnectAttempts = useRef(0);
  const connectRef = useRef<() => Promise<void>>(async () => {});
  const queue = useRef<QueuedUpdate[]>([]);
  const clientId = useRef("");
  const clock = useRef(0);

  useEffect(() => {
    try {
      const storedClient = window.localStorage.getItem(clientKey(workspaceId));
      clientId.current = storedClient || crypto.randomUUID();
      window.localStorage.setItem(clientKey(workspaceId), clientId.current);
      clock.current = Number(window.localStorage.getItem(clockKey(workspaceId, nodeId)) ?? "0") || 0;
      const rawQueue = window.localStorage.getItem(queueKey(workspaceId, nodeId));
      if (rawQueue) {
        const parsed = JSON.parse(rawQueue) as QueuedUpdate[];
        queue.current = Array.isArray(parsed) ? parsed.slice(-500) : [];
      }
    } catch {
      clientId.current = crypto.randomUUID();
      queue.current = [];
      clock.current = 0;
    }
  }, [nodeId, workspaceId]);

  const persistQueue = useCallback(() => {
    try {
      window.localStorage.setItem(
        queueKey(workspaceId, nodeId),
        JSON.stringify(queue.current.slice(-500)),
      );
      window.localStorage.setItem(clockKey(workspaceId, nodeId), String(clock.current));
    } catch {
      // Offline queue persistence is best effort; websocket state remains live in memory.
    }
  }, [nodeId, workspaceId]);

  const applySnapshot = useCallback((state: {
    checkpoint?: CollaborationSnapshot;
    updates?: Array<{ registers?: CrdtRegister[] }>;
  }) => {
    let merged: Record<string, CrdtRegister> = {
      ...(state.checkpoint?.registers ?? {}),
    };
    for (const update of state.updates ?? []) {
      merged = mergeRegisters(merged, update.registers ?? []);
    }
    setRegisters(merged);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (stopped.current || reconnectTimer.current !== null) return;
    const delay = Math.min(10_000, 500 * 2 ** Math.min(reconnectAttempts.current, 5));
    reconnectAttempts.current += 1;
    reconnectTimer.current = window.setTimeout(() => {
      reconnectTimer.current = null;
      void connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    if (stopped.current) return;
    setStatus(navigator.onLine ? "connecting" : "offline");
    if (!navigator.onLine) {
      scheduleReconnect();
      return;
    }

    try {
      const response = await fetch(`/api/collaboration/${workspaceId}/${nodeId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "token" }),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setStatus("denied");
          return;
        }
        throw new Error("Unable to authorize collaboration room.");
      }
      const token = (await response.json()) as TokenResponse;
      setCapabilities(token.capabilities);
      const socket = new WebSocket(token.websocketUrl, ["nexosophy", token.token]);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts.current = 0;
        setStatus("connected");
        for (const update of queue.current) {
          socket.send(JSON.stringify({ type: "update", update }));
        }
      };

      socket.onmessage = (event) => {
        let message: any;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (message.type === "sync" && message.state) {
          applySnapshot(message.state);
          return;
        }
        if (message.type === "update" && message.update?.registers) {
          setRegisters((current) =>
            mergeRegisters(current, message.update.registers as CrdtRegister[]),
          );
          return;
        }
        if (message.type === "ack") {
          queue.current = queue.current.filter(
            (item) =>
              !(
                item.clientId === message.clientId &&
                item.clock === Number(message.clock)
              ),
          );
          persistQueue();
          return;
        }
        if (message.type === "presence" && message.connectionId) {
          setPresence((current) => ({
            ...current,
            [message.connectionId]: {
              userId: String(message.userId),
              connectionId: String(message.connectionId),
              presence: message.presence ?? {},
            },
          }));
          return;
        }
        if (message.type === "presence.leave" && message.connectionId) {
          setPresence((current) => {
            const next = { ...current };
            delete next[String(message.connectionId)];
            return next;
          });
          return;
        }
        if (message.type === "comment.refresh") {
          window.dispatchEvent(
            new CustomEvent("nexosophy:comments-refresh:" + nodeId, {
              detail: { commentId: message.commentId ?? null },
            }),
          );
        }
      };

      socket.onclose = (event) => {
        if (wsRef.current === socket) wsRef.current = null;
        setPresence({});
        if (stopped.current) return;
        if (event.code === 4003) {
          setStatus("denied");
          return;
        }
        setStatus(navigator.onLine ? "connecting" : "offline");
        scheduleReconnect();
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN) socket.close();
      };
    } catch {
      setStatus(navigator.onLine ? "connecting" : "offline");
      scheduleReconnect();
    }
  }, [applySnapshot, nodeId, persistQueue, scheduleReconnect, workspaceId]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    stopped.current = false;
    void connect();
    const onOnline = () => {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        void connect();
      }
    };
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stopped.current = true;
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000, "page closed");
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [connect]);

  const sendUpdate = useCallback(
    (updates: Array<Omit<CrdtRegister, "actor">>) => {
      if (!clientId.current || updates.length === 0) return;
      clock.current += 1;
      const update: QueuedUpdate = {
        clientId: clientId.current,
        clock: clock.current,
        registers: updates.map((register) => ({
          ...register,
          actor: clientId.current,
        })),
      };
      queue.current.push(update);
      persistQueue();
      setRegisters((current) => mergeRegisters(current, update.registers));
      const socket = wsRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "update", update }));
      } else {
        setStatus("offline");
      }
    },
    [persistQueue],
  );

  const sendPresence = useCallback((nextPresence: PresenceState) => {
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "presence", presence: nextPresence }));
    }
  }, []);

  const notifyCommentRefresh = useCallback((commentId?: string) => {
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "comment.refresh", commentId: commentId ?? null }));
    }
  }, []);

  const value = useMemo<RealtimeRoomContextValue>(
    () => ({
      status,
      capabilities,
      registers,
      presence,
      sendUpdate,
      sendPresence,
      notifyCommentRefresh,
    }),
    [
      capabilities,
      notifyCommentRefresh,
      presence,
      registers,
      sendPresence,
      sendUpdate,
      status,
    ],
  );

  return (
    <RealtimeRoomContext.Provider value={value}>
      {children}
    </RealtimeRoomContext.Provider>
  );
}

export function useRealtimeRoom(): RealtimeRoomContextValue {
  const value = useContext(RealtimeRoomContext);
  if (!value) throw new Error("useRealtimeRoom must be used inside RealtimeRoomProvider.");
  return value;
}
