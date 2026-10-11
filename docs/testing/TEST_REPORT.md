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

## Final verification checkpoint — 2026-10-11
- Real Google OAuth: PASS. User completed Google consent; callback, Go-protected profile and persistence after reload verified. See OAUTH_VERIFICATION.md.
- Hosted account deletion: PASS — hosted-erasure-isolated.log. Only a disposable hosted Auth account was deleted; application data used a disposable local PostgreSQL database. Login and stale-token access were rejected afterward.
- Current desktop suite: **13 passed** — release-final.log/json. Real Go API/PostgreSQL/Auth, no mocked application endpoints.
- Go unit/race and race-enabled Testcontainers: PASS — release-go-unit.log, release-go-race.log, release-query-audit.log.
- Frontend formatting/lint/typecheck/Vitest/build: PASS — release-*.log.
- Added browser coverage: review edit/delete/report and literal script text; private/public list visibility, unauthorized writes and likes; unfollow/read notifications; diary pagination/filter/delete, network retry, double-click idempotency and cross-tab sign-out; password recovery through local Mailpit; watchlist ownership; keyboard dialog focus, reduced motion and 320px text-spacing reflow.
- Fixed inaccessible list-like responses, unbounded collection/profile reads, oversized embedded film payloads, dialog focus escape, narrow header/hero overflow and local recovery redirect configuration. Failure-run evidence is retained.
- Query plans from real PostgreSQL with RLS and 2,000-row fixtures: query-plans.json. This is bounded local query evidence, not production load certification.
- Architecture: 16 implementation anchors verified with file hashes and line spans in ../architecture/SOURCE_AUDIT.md. Eight Archify description artifacts retain their passing checks; remote repository provenance remains unavailable.
- Accessibility: axe checks plus keyboard/reflow tests pass; the saved 320px text-spacing screenshot was visually reviewed. No claim of comprehensive human screen-reader testing.

## Coverage limitations and release decision
**NOT READY TO PUBLISH.** Hosted email confirmation, production permissions/proxy behavior, load testing, installed-device PWA lifecycle, manual assistive-technology testing, full discovery/analytics/moderation scope and broad competitor validation are not established by these tests. Archify repository-backed provenance requires a real remote identity. A verification skill's existence is not feature completion.

No public deployment or hosted application-database migrations occurred. Public deployment remains subject to explicit authorization. Credentials remain in local ignored environment files; evidence contains no authentication tokens.

## Final mobile and performance results
- Final mobile suite: **13 passed** — release-mobile.log/json.
- Updated Go container build: PASS — release-docker-build.log.
- Final local Lighthouse mobile: performance 93, accessibility 100, best-practices 100, seo 100, agentic-browsing 100. largest-contentful-paint: 2.7 s, cumulative-layout-shift: 0.01, total-blocking-time: 220 ms. See lighthouse-release.report.json/html. Single local lab run, not field or load metrics.

## Authorized public deployment checkpoint
The user subsequently authorized deployment and public source publication. GitHub Pages and Render Free are live; hosted migrations and browser access restrictions passed. Public browser smoke verification passed sign-in, protected profile, film logging, private memory request, diary persistence, mobile Settings sign-out and disposable hosted account erasure with zero page errors (deployment-browser-smoke.log). See ../DEPLOYMENT.md for URLs and exact scope. This does not supersede the broader feature/manual/load coverage limitations above.
