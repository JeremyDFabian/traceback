#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$repo_root/apps/api"
PYTHONPATH=. uv run python ../../scripts/export_openapi.py

cd "$repo_root"
corepack pnpm --filter @traceback/api-client exec openapi-typescript \
  openapi.json \
  --output src/schema.d.ts
corepack pnpm --filter @traceback/api-client exec prettier \
  --write \
  openapi.json \
  src/schema.d.ts
