#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Nexosophy bootstrap"
echo "Repository: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Use the version pinned in .nvmrc." >&2
  exit 1
fi

EXPECTED_NODE="$(cat .nvmrc)"
ACTUAL_NODE="$(node --version | sed 's/^v//')"

if [[ "$ACTUAL_NODE" != "$EXPECTED_NODE" ]]; then
  echo "Expected Node $EXPECTED_NODE but found $ACTUAL_NODE." >&2
  exit 1
fi

corepack enable
corepack prepare pnpm@12.7.0 --activate

pnpm install --frozen-lockfile
pnpm ci:fast
pnpm ci:build

echo "==> Bootstrap validation passed."
