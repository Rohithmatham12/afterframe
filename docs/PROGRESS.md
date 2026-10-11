# Afterframe progress

## Current checkpoint
Local app runs at http://127.0.0.1:3000 with real Go API, PostgreSQL and local Supabase Auth. Docker repaired. Required Go/Node stack used. No cloud infrastructure changed.

Completed: foundation UI/API, three differentiators, ownership/RLS, transactions, local account erasure, generated client/sqlc, Compose dependencies, container build, Apple Design/Archify integration, 15 verification skill files, three documented simplification passes.

Verification: unit/race/Testcontainers pass; frontend lint/Vitest/build/audit pass; five-persona desktop round 1 passes, fresh-account round 2 passes; expanded signed-in accessibility/offline test passes. Mobile round 3 passes all eight tests. Social likes/comments/notifications/blocking also pass. Cast/crew metadata and sign-out cleanup added; final eight-test regression passed. Additional search/resurface/rewatch/avatar assertions passed; final complete current suite passes all 8 tests. See docs/testing/TEST_REPORT.md for evidence and limitations.

## Resume next
1. Continue remaining scope listed in docs/testing/VERIFICATION_SKILLS.md.
2. Complete missing persona/adversarial coverage, social notifications/blocks and performance audit.
3. Complete master-brief feature gaps and documentation; do not interpret current test coverage as exhaustive.
4. Recheck final generated artifacts, release report, source provenance and credential configuration.

## External blockers
Root .env SUPABASE_URL formatting fixed: pasted Markdown link normalized to the correct dashboard URL. Hosted Auth responds HTTP 200; Google provider is enabled. Hosted account erasure requires SUPABASE_SECRET_KEY. Hosted Google OAuth is unverified. Repository has no remote, blocking Archify repository-backed provenance; eight explicitly labeled local-description diagrams pass automated artifact checks. Public deployment is not authorized.

## Release
NOT READY TO PUBLISH. Keep completed milestones; do not restart discovery.
