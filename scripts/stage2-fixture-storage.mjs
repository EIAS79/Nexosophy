// Local-only HTTPS fixture store for Stage 2 media acceptance.
// Not a replacement for a real S3 provider, presigning, or authentication.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:https";
import { join, resolve } from "node:path";

const dir = "/fixtures";
const key = await readFile(join(dir, "key.pem"));
const cert = await readFile(join(dir, "cert.pem"));
const server = createServer({ key, cert }, async (req, res) => {
  const parsed = new URL(req.url ?? "/", "https://localhost");
  const path = parsed.pathname;
  if (
    !parsed.searchParams.has("X-Amz-Signature") ||
    !/^\/(?:inputs|outputs)\/[a-z0-9_.-]+$/.test(path)
  ) {
    res.writeHead(403);
    return res.end();
  }
  const target = resolve(dir, "." + path);
  if (req.method === "GET") {
    try {
      const data = await readFile(target);
      res.writeHead(200, { "content-length": String(data.length) });
      return res.end(data);
    } catch {
      res.writeHead(404);
      return res.end();
    }
  }
  if (req.method === "PUT" && path.startsWith("/outputs/")) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024 * 100) {
        res.writeHead(413);
        return res.end();
      }
      chunks.push(chunk);
    }
    await mkdir(join(dir, "outputs"), { recursive: true });
    await writeFile(target, Buffer.concat(chunks));
    res.writeHead(200);
    return res.end();
  }
  res.writeHead(405);
  res.end();
});
server.listen(443, "127.0.0.1", () => {
  console.log("LOCAL ONLY Stage 2 HTTPS fixture store listening on 127.0.0.1:443");
});
