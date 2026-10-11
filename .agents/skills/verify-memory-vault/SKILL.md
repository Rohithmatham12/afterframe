---
name: verify-memory-vault
description: Verify Afterframe memory-vault against its real local Go API and PostgreSQL.
---
# Verify memory-vault

## Purpose and expected outcomes
Verify create, keyword/fuzzy search, edit, delete, resurfacing and ownership. A rendered control is not evidence of working behavior.

## Preconditions and environment
Node 24, Go 1.26.4, Docker ready. Populate server-only TMDB_READ_ACCESS_TOKEN in .env. Use generated .env.local local database/auth configuration; never production for destructive tests. Local app/API ports 3000/8080 and Auth 54321.

## Boot and database
From repository root: `python3 scripts/init-local.py`; `python3 scripts/frontend-env.py`; `docker compose --env-file .env.local up -d`.
From backend: `AFTERFRAME_LOCAL=1 go run ./cmd/migrate`; `AFTERFRAME_LOCAL=1 go run ./cmd/api`.
From frontend: `npm run build`; `python3 -m http.server 3000 --bind 127.0.0.1 --directory out`.

## Test data and procedure
Use fictional local users with unique per-run suffixes. Browser journeys are in frontend/tests/e2e/journeys.spec.ts. Execute applicable persona interactions covering create, keyword/fuzzy search, edit, delete, resurfacing and ownership, refresh, log back in, and inspect database/API state. Use a second browser context for authorization negatives. Do not replace app API responses with mocks.

## Commands
Backend: `go test ./...`; `go test -race ./internal/...`; `go test -tags=integration ./internal/service -v`.
Frontend: `npm run typecheck`; `npm test`; `SIMULATION_ROUND=1 npm run e2e`. Repeat with rounds 2 and 3 using new fictional users and the final production build.

## Negative/security cases
Reject malformed inputs, invalid sessions, unauthorized edits, and cross-user private retrieval. Hidden spoiler text must be absent from response bodies, DOM, notification text, and shared caches.

## Evidence and cleanup
Store command output, JSON reports and screenshots in docs/testing. Testcontainers database is automatically removed. Do not persist bearer tokens or passwords in traces. Clean only isolated test users/databases; never real user records.

## Pass/fail criteria and limitations
PASS only when all listed feature checks have executed successfully. Missing scenarios, external setup, or credentials are BLOCKED/NOT VERIFIED, never inferred PASS. Record actual coverage in docs/testing/TEST_REPORT.md. Full auth requires separate live Google OAuth verification; local email auto-confirm does not prove hosted verification behavior.
