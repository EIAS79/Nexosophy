import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const preview = process.argv.includes("--host");
const child = spawn(
  process.execPath,
  preview
    ? ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "4173"]
    : ["node_modules/turbo/bin/turbo", "run", "dev", "--parallel"],
  { cwd: preview ? `${root}apps/web` : root, stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
