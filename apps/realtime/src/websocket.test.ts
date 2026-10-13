import { Duplex } from "node:stream";
import { describe, expect, it } from "vitest";

import { WebSocketPeer } from "./websocket.js";

class SocketFixture extends Duplex {
  sent: Buffer[] = [];
  override _read(): void {}
  override _write(chunk: Buffer, _encoding: BufferEncoding, done: (error?: Error | null) => void) {
    this.sent.push(Buffer.from(chunk));
    done();
  }
}

function maskedText(text: string): Buffer {
  const data = Buffer.from(text, "utf8");
  const mask = Buffer.from([13, 20, 21, 3]);
  if (data.length >= 126) throw new Error("Test text too long");
  const header = Buffer.from([0x81, 0x80 | data.length]);
  const coded = Buffer.from(data);
  for (let i = 0; i < coded.length; i += 1) coded[i] = coded[i]! ^ mask[i % 4]!;
  return Buffer.concat([header, mask, coded]);
}
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("Realtime WebSocket framing and revocation lifecycle", () => {
  it("handles two masked messages in wire order despite an async first write", async () => {
    const socket = new SocketFixture();
    const peer = new WebSocketPeer(socket, 1024);
    const calls: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    peer.onMessage(async (value) => {
      calls.push("start:" + value);
      if (value === "first") await firstGate;
      calls.push("end:" + value);
    });
    socket.push(Buffer.concat([maskedText("first"), maskedText("second")]));
    await flush();
    expect(calls).toEqual(["start:first"]);
    releaseFirst();
    await flush();
    expect(calls).toEqual(["start:first","end:first","start:second","end:second"]);
    peer.close();
    socket.destroy();
  });

  it("rejects unmasked client frames and fragmented frames", async () => {
    const unmaskedSocket = new SocketFixture();
    const unmasked = new WebSocketPeer(unmaskedSocket, 1024);
    unmaskedSocket.push(Buffer.from([0x81, 0x01, 0x61]));
    await flush();
    expect(unmaskedSocket.sent.some((frame) => (frame[0]! & 15) === 0x8)).toBe(true);
    const fragmentedSocket = new SocketFixture();
    const fragmented = new WebSocketPeer(fragmentedSocket, 1024);
    fragmentedSocket.push(Buffer.from([0x01, 0x80, 0, 0, 0, 0]));
    await flush();
    expect(fragmentedSocket.sent.some((frame) => (frame[0]! & 15) === 0x8)).toBe(true);
    unmasked.close();
    fragmented.close();
    unmaskedSocket.destroy();
    fragmentedSocket.destroy();
  });

  it("releases connection lifecycle on transport errors exactly once", async () => {
    const socket = new SocketFixture();
    const peer = new WebSocketPeer(socket, 1024);
    let closes = 0;
    peer.onClose(() => { closes += 1; });
    socket.emit("error", new Error("Test connection dropped"));
    socket.destroy();
    await flush();
    expect(closes).toBe(1);
  });

  it("enforces the message size cap before allocating full oversized bodies", async () => {
    const socket = new SocketFixture();
    const peer = new WebSocketPeer(socket, 10);
    socket.push(Buffer.from([0x81, 0xFE, 0x00, 0x20]));
    await flush();
    expect(socket.sent.some((frame) => (frame[0]! & 15) === 0x8)).toBe(true);
    peer.close();
    socket.destroy();
  });
});
