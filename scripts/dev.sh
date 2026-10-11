#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/init-local.py
python3 scripts/frontend-env.py
docker compose --env-file .env.local up -d
(cd backend && AFTERFRAME_LOCAL=1 go run ./cmd/migrate)
(cd backend && AFTERFRAME_LOCAL=1 go run ./cmd/api) &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
(cd frontend && npm run dev)
