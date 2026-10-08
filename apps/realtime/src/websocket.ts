import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";

type MessageHandler = (message: string) => void | Promise<void>;
type CloseHandler = () => void;

function serverFrame(opcode: number, payload: Buffer): Buffer {
  const first = 0x80 | (opcode & 0x0f);
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([first, payload.length]), payload]);
  }
  if (payload.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = first;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = first;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

export class WebSocketPeer {
  private buffer = Buffer.alloc(0);
  private closed = false;
  private messageHandler: MessageHandler | null = null;
  private closeHandler: CloseHandler | null = null;

  constructor(
    readonly socket: Socket,
    readonly maxMessageBytes: number,
  ) {
    socket.on("data", (chunk: Buffer) => this.onData(chunk));
    socket.on("close", () => {
      if (this.closed) return;
      this.closed = true;
      this.closeHandler?.();
    });
    socket.on("error", () => {
      this.closed = true;
    });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onClose(handler: CloseHandler): void {
    this.closeHandler = handler;
  }

  sendJson(value: unknown): void {
    if (this.closed) return;
    const payload = Buffer.from(JSON.stringify(value), "utf8");
    this.socket.write(serverFrame(0x1, payload));
  }

  close(code = 1000, reason = "normal"): void {
    if (this.closed) return;
    this.closed = true;
    const reasonBytes = Buffer.from(reason.slice(0, 120), "utf8");
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);
    try {
      this.socket.write(serverFrame(0x8, payload));
    } finally {
      this.socket.end();
      this.closeHandler?.();
    }
  }

  private onData(chunk: Buffer): void {
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0]!;
      const second = this.buffer[1]!;
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;

      if (!fin || opcode === 0x0) {
        this.close(1003, "fragmentation unsupported");
        return;
      }
      if (!masked) {
        this.close(1002, "client frames must be masked");
        return;
      }
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const longLength = this.buffer.readBigUInt64BE(2);
        if (longLength > BigInt(this.maxMessageBytes)) {
          this.close(1009, "message too large");
          return;
        }
        length = Number(longLength);
        offset = 10;
      }
      if (length > this.maxMessageBytes) {
        this.close(1009, "message too large");
        return;
      }
      if (this.buffer.length < offset + 4 + length) return;

      const mask = this.buffer.subarray(offset, offset + 4);
      offset += 4;
      const payload = Buffer.from(this.buffer.subarray(offset, offset + length));
      this.buffer = this.buffer.subarray(offset + length);
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] = payload[index]! ^ mask[index % 4]!;
      }

      if (opcode === 0x8) {
        this.close(1000, "client closed");
        return;
      }
      if (opcode === 0x9) {
        this.socket.write(serverFrame(0xA, payload));
        continue;
      }
      if (opcode !== 0x1) {
        this.close(1003, "text frames only");
        return;
      }

      const message = payload.toString("utf8");
      void Promise.resolve(this.messageHandler?.(message)).catch(() => {
        this.close(1011, "message handler failed");
      });
    }
  }
}

export function acceptWebSocket(
  request: IncomingMessage,
  socket: Socket,
  protocol: string,
  maxMessageBytes: number,
): WebSocketPeer {
  const key = request.headers["sec-websocket-key"];
  const version = request.headers["sec-websocket-version"];
  if (typeof key !== "string" || version !== "13") {
    throw new Error("INVALID_WEBSOCKET_HANDSHAKE");
  }
  const accept = createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Accept: " + accept,
      "Sec-WebSocket-Protocol: " + protocol,
      "\r\n",
    ].join("\r\n"),
  );
  return new WebSocketPeer(socket, maxMessageBytes);
}

export function rejectUpgrade(socket: Socket, status: number, message: string): void {
  const reason =
    status === 401
      ? "Unauthorized"
      : status === 403
        ? "Forbidden"
        : status === 429
          ? "Too Many Requests"
          : "Bad Request";
  const body = message.slice(0, 500);
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(
      body,
    )}\r\nConnection: close\r\n\r\n${body}`,
  );
}
