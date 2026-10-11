# Afterframe

A cinema journal with private memory recall, append-only opinion history, and server-enforced layered reviews.

## Local development

Use Node 24 and Go 1.26.4. Docker Desktop must be running.

```sh
cd /Users/rohithmatam/Documents/all/afterframe
nvm use 24
python3 scripts/init-local.py
python3 scripts/frontend-env.py
docker compose --env-file .env.local up -d
cd backend
AFTERFRAME_LOCAL=1 go run ./cmd/migrate
AFTERFRAME_LOCAL=1 go run ./cmd/api
```

In a second terminal:

```sh
cd /Users/rohithmatam/Documents/all/afterframe/frontend
nvm use 24
npm ci
npm run dev
```

Web: http://127.0.0.1:3000 · API: http://127.0.0.1:8080 · local test email: http://127.0.0.1:8025

Production-mode local browser testing: `npm run build`, then `python3 -m http.server 3000 --bind 127.0.0.1 --directory out` from frontend.

## Environment and secrets

- `.env`: user-provided `TMDB_READ_ACCESS_TOKEN`, `SUPABASE_URL` (absolute project API URL), `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `RENDER_API_KEY`.
- `.env.local`: generated local database/auth secrets and local overrides. Never used unless `AFTERFRAME_LOCAL=1` is explicit.
- `frontend/.env.local`: public local API/Auth URL and publishable key only. No TMDB, database password, Render token, or auth signing key in frontend.
- Production `API_ORIGINS`: exact permitted GitHub Pages origin (no wildcard); `PORT` supplied by Render.
- Production `NEXT_PUBLIC_BASE_PATH`: `/repository-name` for project Pages, empty for custom domain/root Pages.

Local GoTrue lives in a separate local database and automatically confirms fictional test emails. This is a real Supabase Auth service, not a fake application auth endpoint. Hosted Google OAuth was verified separately against the configured project; hosted email confirmation remains outside this local test coverage.

No paid AI. Memory search uses PostgreSQL full-text search and trigram similarity; it does not guarantee interpretation of arbitrary natural-language date expressions. pgvector is installed but unused.

## Commands

```sh
cd backend
sqlc generate
go test ./...
go test -race ./internal/...
go test -tags=integration ./internal/service -v
cd ../frontend
npm run generate
npm run typecheck
npm test
npm run build
SIMULATION_ROUND=1 npm run e2e
```

Integration tests create and remove their own PostgreSQL container. Browser tests create fictional local Supabase users. Never point destructive test setup at production.

## Deployment

`render.yaml`, `backend/Dockerfile`, and `.github/workflows/pages.yml` prepare free hosting. Public deployment was authorized on 2026-10-11. The Pages workflow builds and deploys the static frontend. Render's free service can sleep; first requests may be delayed. Review current free quotas before authorizing deployment. Apply SQL migrations separately with a migration role; runtime transaction role `afterframe_api` must be granted to the deployed database login. Supabase browser roles have no direct application-table access.

## Status

See `docs/PROGRESS.md` and `docs/testing/TEST_REPORT.md`. The application is not release-ready until every required gate has actually passed.

## Hosted configuration
`SUPABASE_URL` in the root `.env` is now a plain HTTPS URL. A pasted Markdown link caused the earlier failure; normalization restored HTTP 200 from Supabase Auth. Real hosted Google OAuth and disposable hosted-account deletion passed; see `docs/testing/OAUTH_VERIFICATION.md`. `SUPABASE_SECRET_KEY` is server-only and must never enter frontend environment variables. `go run ./cmd/verify-hosted` is an explicitly opt-in hosted test that creates and deletes one disposable Auth user and uses an isolated local database; do not run it automatically in CI. `AFTERFRAME_LOCAL=1` explicitly loads root `.env.local` over `.env`; `scripts/frontend-env.py` intentionally writes the matching local frontend configuration. Hosted provider checks read root `.env` only.

Deployment progress and live URLs are recorded in `docs/DEPLOYMENT.md`.
