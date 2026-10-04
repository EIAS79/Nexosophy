import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const ROOTS = ["apps", "packages"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const allowedWorkspaceImports = {
  "apps/web": new Set(["@nexosophy/ui", "@nexosophy/contracts"]),
  "apps/api": new Set([
    "@nexosophy/config",
    "@nexosophy/contracts",
    "@nexosophy/db",
    "@nexosophy/observability",
    "@nexosophy/auth",
    "@nexosophy/billing",
    "@nexosophy/storage",
  ]),
  "apps/worker": new Set([
    "@nexosophy/config",
    "@nexosophy/contracts",
    "@nexosophy/db",
    "@nexosophy/observability",
    "@nexosophy/auth",
    "@nexosophy/billing",
    "@nexosophy/storage",
  ]),
  "apps/realtime": new Set([
    "@nexosophy/config",
    "@nexosophy/contracts",
    "@nexosophy/db",
    "@nexosophy/observability",
    "@nexosophy/auth",
  ]),
  "packages/ui": new Set(["@nexosophy/contracts"]),
  "packages/config": new Set(),
  "packages/contracts": new Set(),
  "packages/db": new Set(),
  "packages/observability": new Set(),
  "packages/auth": new Set(["@nexosophy/contracts"]),
  "packages/billing": new Set(["@nexosophy/contracts"]),
  "packages/storage": new Set(["@nexosophy/contracts"]),
  "packages/testing": new Set([
    "@nexosophy/config",
    "@nexosophy/contracts",
    "@nexosophy/db",
    "@nexosophy/observability",
    "@nexosophy/auth",
    "@nexosophy/billing",
    "@nexosophy/storage",
    "@nexosophy/ui",
  ]),
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (["node_modules", ".next", "dist", "coverage"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }

  return files;
}

function ownerFor(file) {
  const parts = relative(process.cwd(), file).split(sep);
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
}

function workspaceImports(source) {
  const imports = new Set();
  const patterns = [
    /from\s+["'](@nexosophy\/[^/"']+)/g,
    /import\s*\(\s*["'](@nexosophy\/[^/"']+)["']\s*\)/g,
    /import\s+["'](@nexosophy\/[^/"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) imports.add(match[1]);
    }
  }

  return imports;
}

const violations = [];

for (const root of ROOTS) {
  for (const file of await walk(join(process.cwd(), root))) {
    const owner = ownerFor(file);
    if (!owner || !allowedWorkspaceImports[owner]) continue;

    const source = await readFile(file, "utf8");
    for (const imported of workspaceImports(source)) {
      if (!allowedWorkspaceImports[owner].has(imported)) {
        violations.push(
          `${relative(process.cwd(), file)} imports ${imported}, which is outside ${owner}'s allowed workspace boundaries`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`Workspace boundary violations:\n- ${violations.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write("Workspace dependency boundaries are valid.\n");
