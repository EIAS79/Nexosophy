import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "./index.js";

describe("structured logging", () => {
  it("redacts authorization headers and common secret fields", async () => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));

    const logger = createLogger("test", "info", {}, stream);

    logger.info(
      {
        headers: {
          authorization: "Bearer super-secret-token",
          cookie: "session=secret-session-cookie",
        },
        password: "secret-password",
        token: "secret-token",
        nested: {
          secret: "secret-value",
        },
      },
      "redaction-check",
    );

    await new Promise<void>((resolve) => {
      stream.end(resolve);
    });

    const output = Buffer.concat(chunks).toString("utf8");

    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("super-secret-token");
    expect(output).not.toContain("secret-session-cookie");
    expect(output).not.toContain("secret-password");
    expect(output).not.toContain("secret-token");
    expect(output).not.toContain("secret-value");
  });
});
