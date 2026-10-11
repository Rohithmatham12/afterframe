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

Local GoTrue lives in a separate local database and automatically confirms fictional test emails. This is a real Supabase Auth service, not a fake application auth endpoint. Hosted Google OAuth and email confirmation must be verified separately against the configured project before release.

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

`render.yaml`, `backend/Dockerfile`, and `.github/workflows/pages.yml` prepare free hosting. **No deployment has been performed or authorized.** The Pages workflow only creates an artifact. Render's free service can sleep; first requests may be delayed. Review current free quotas before authorizing deployment. Apply SQL migrations separately with a migration role; runtime transaction role `afterframe_api` must be granted to the deployed database login. Supabase browser roles have no direct application-table access.

## Status

See `docs/PROGRESS.md` and `docs/testing/TEST_REPORT.md`. The application is not release-ready until every required gate has actually passed.

## Hosted configuration remains blocked
Set `SUPABASE_URL` in the root `.env` to the full project URL (`https://<project-ref>.supabase.co`). The current value did not pass URL validation. Hosted account deletion also needs server-only `SUPABASE_SECRET_KEY` in that file. Never copy this key into frontend environment variables. Local tests use isolated GoTrue credentials and do not verify Google OAuth.

No public deployment or cloud mutation has run. The Pages workflow only prepares an artifact; Render configuration is unapplied.
