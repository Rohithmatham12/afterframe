# Public deployment

Authorized by the user on 2026-10-11. Target: GitHub Pages, Render Free, Supabase Free. No paid resources authorized.

Preflight: GitHub and Render authentication passed. Hosted database connection passed after URL-encoding password characters locally; the public schema contained zero tables before migration. Hosted browser-role restrictions were tested with race-enabled PostgreSQL Testcontainers before application.

Hosted migrations 000001–000008 applied successfully. Verified that anon/authenticated/PUBLIC have no application-table grants and that the Go transaction role can perform the RLS-protected read. Evidence: testing/deployment-hosted-migrations.log and testing/deployment-hosted-permissions.log.

Repository creation was blocked by automatic approval review: deployment authorization did not explicitly authorize publishing source code publicly. Awaiting the user’s choice between public source and private source with public built assets. No repository, Pages site or Render service has been created.

Deployment in progress. Local release limitations remain documented in testing/TEST_REPORT.md; deployment authorization is not a declaration that every original feature gate passed.
