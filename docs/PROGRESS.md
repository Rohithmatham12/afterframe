# Afterframe progress

## Approved decisions
Go 1.26.4 + Chi modular monolith; Next.js static export + React/TypeScript/Tailwind on GitHub Pages; Supabase PostgreSQL/Auth; pgx/sqlc; OpenAPI client; no paid AI. Prepare Render Free config only. No cloud mutations or public deployment authorized.

## Completed
- Isolated project created, credentials stored with 0600 permissions and gitignored.
- All five required variable names populated; TMDB read-only movie request returned HTTP 200.
- Docker Desktop started; daemon 28.1.1 reachable.
- Apple Design and Archify installed into repository-local .agents/skills and instructions read. Initial installation paths failed; corrected using upstream repository tree.

## Current work
Environment validation, local database/auth infrastructure, API contract and foundation vertical slice.

## Open failures / risks
- SUPABASE_URL does not currently parse as an absolute URL; diagnosing without exposing values.
- Application, tests, audits, and all release gates pending.
- Render key presence checked only: no Render API calls or cloud changes.

## Next
Complete local Compose environment, create versioned schema, Go API, and static frontend; execute foundation tests.

## Release
NOT READY TO PUBLISH. No application tests executed yet.

## Checkpoint: local application running
- Production static frontend serves at http://127.0.0.1:3000; Go API at port 8080.
- Local GoTrue CORS/schema issues repaired; real signup/login works.
- Casual viewer, cinephile, and Memory Vault browser journeys have passed on targeted runs.
- Go unit, race, and real PostgreSQL Testcontainers checks have passed for the first implementation; subsequent feature additions are undergoing regression.
- RLS now runs through a transaction-local non-superuser role. Opinion updates are revoked.
- Profile/network pages, list likes, current rating, server-owned comparisons, validated avatar upload, and durable account-erasure retry are being completed.
- Initial browser failures preserved; mandatory complete three-round matrix not yet passed.
- Hosted SUPABASE_URL still invalid; no cloud resources changed. Google OAuth remains unverified.
- npm audit now reports zero vulnerabilities after replacing the development lint chain.
