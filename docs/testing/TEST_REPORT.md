# Afterframe verification report

Release decision: **NOT READY TO PUBLISH**. Local checks below are executed evidence, not proof all master-prompt gates are complete.

## Environment
Node 24.11.1, Go 1.26.4, macOS arm64, system Chrome through Playwright. Static Next.js production export at 127.0.0.1:3000, real Go API :8080, PostgreSQL/pgvector :55432, local Supabase GoTrue :54321. Fictional accounts are unique per run. No application endpoint mocks. Provider-unit simulations are explicitly isolated HTTP test servers. No hosted migrations/deployment.

## Executed results
- Go unit: PASS — go-unit-final.log.
- Go race: PASS — go-race-final.log.
- Testcontainers PostgreSQL with race: PASS — go-integration-final.log. Covers transaction idempotency, memory isolation/search/edit/delete, timeline history, spoiler disclosure/comments, list ownership.
- Frontend lint, Vitest (2 component tests), production build: PASS — lint.log, vitest.log, build-final.log.
- npm dependency audit: zero vulnerabilities — npm-audit-final.json.
- Go deployment image: PASS — docker-build.log.
- Round 1: 5 personas + responsive audit, 6 passed — round-1-passed.json.
- Round 2: new accounts, same 5 personas + responsive/privacy-erasure, 7 passed — round-2.log.
- Authenticated accessibility/history/offline test: PASS — accessibility-expanded.log. Seven authenticated screens checked by axe; no page errors in that journey.
- Round 3 mobile: PASS, 8 tests including all five personas — round-3-mobile.log and round-3-mobile-passed.json.
- Eight Archify local-description artifacts passed schema/delivery/provenance-of-artifact/browser checks. Repository-backed source provenance remains blocked (no remote identity).

## Failures found and corrected
Local GoTrue schema/CORS; duplicate film-title selectors; memory label association; duplicate list-name test selectors; stale route review data; shared-IP rate exhaustion. Failure reports remain in this directory. Invalid avatar test initially expected punctuation different from Go's actual error; corrected assertion, then privacy and complete local auth-account erasure passed.

- Expanded social journey: PASS, likes/comments/notifications/blocking — social-expanded.log.
- Local latency measurements: performance-local.json; warm sequential samples only, not production load or Core Web Vitals.

- Post-catalog/session-cleanup regression: PASS, all 8 tests — final-regression.log.

- Added search/resurface/separate-rewatch/valid-avatar assertions: PASS, 4 affected journeys — expanded-regression.log and expanded-regression-passed.json.
- Earlier suites shared one JSON reporter filename; the round 2 and post-catalog results are preserved in their complete text logs. Differently scoped JSON runs were renamed to reflect their actual contents. New runs support REPORT_NAME to avoid overwriting evidence.

- Final complete current suite: PASS, 8 tests — final-complete.json and final-complete.log.

## Coverage limitations
The browser scenarios do not yet exhaust every step and adversarial case in the master brief. Hosted email/Google OAuth, production permissions/proxy behavior, performance budgets under load, full analytics, broad competitor validation, discovery completeness, moderation operations and claim-level architecture evidence remain open. A verification skill file's existence/schema validation is not feature completion.

## External setup
Root .env SUPABASE_URL needs an absolute project URL. Hosted erasure requires SUPABASE_SECRET_KEY. Public deployment requires explicit authorization. No secrets are recorded in evidence.
