import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "nexosophy-worker-runtime-"));

try {
  const isWindows = process.platform === "win32";
  const result = spawnSync(
    isWindows ? "pnpm.cmd" : "pnpm",
    ["--filter", "@nexosophy/worker", "--prod", "deploy", "--legacy", directory],
    { stdio: "inherit", shell: isWindows },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("Worker production dependency deployment failed.");
  }

  const runtimeRequire = createRequire(join(directory, "package.json"));
  for (const dependency of ["bullmq", "ioredis"]) {
    runtimeRequire.resolve(dependency);
  }

  process.stdout.write("Worker production dependencies verified: bullmq and ioredis.\n");
} finally {
  await rm(directory, { recursive: true, force: true });
}
