# Behavior-preserving simplification

## Pass 1 — Foundation
Reviewed Go routing/auth/catalog/services, sqlc queries, frontend forms and API access.
- Kept one Go transaction helper setting viewer context and consistently rolling back failures.
- Centralized spoiler response filtering before serialization instead of repeated frontend gates.
- Shared frontend mutation form handles submission state/errors; forms retain only UI state.
- Used generated OpenAPI models and sqlc database methods rather than duplicated models.
- Removed deployment-specific Next.js runtime requirements by static export and client-side hash routes.
- Kept dedicated auth migration ledger to avoid a collision with GoTrue's migration table.
Validation executed: Go unit tests, race tests, Testcontainers integration (including all three USPs), 2 frontend component tests; static production build succeeds.
Caveat: these are foundation checks, not full release verification. Full persona journeys underway.

## Pass 2 — Feature modules
Pending.

## Pass 3 — Post-E2E
Pending.

## Pass 2 — Feature modules and review
Reviewed frontend components, public DTOs, transaction queries, auth integration, and the three differentiators.
- Removed the frontend grouping/earliest/latest calculations for Taste Timeline. Go's taste package now owns comparisons; the frontend only renders generated API types.
- Extracted spoiler disclosure and deterministic recall interpretation into cohesive Go packages with focused tests.
- Kept one shared mutation form and one generated API client; removed unused imports.
- Replaced eslint-config-next's vulnerable glob dependency chain with ESLint + TypeScript rules; npm audit reports zero vulnerabilities.
- Added year labels for ambiguous film titles and explicit memory field labels after browser failures.
- Formatted source for review and kept local auth initialization isolated from application migrations.
Validation: affected B/C browser journeys passed, typecheck/lint pass, Go unit tests pass; full post-change integration and browser regression in progress. This pass does not count unrun checks as passed.
