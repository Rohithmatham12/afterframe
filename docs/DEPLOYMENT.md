# Public deployment

Authorized by the user on 2026-10-11. Target: GitHub Pages, Render Free, Supabase Free. No paid resources authorized.

Preflight: GitHub and Render authentication passed. Hosted database connection passed after URL-encoding password characters locally; the public schema contained zero tables before migration. Hosted browser-role restrictions were tested with race-enabled PostgreSQL Testcontainers before application.

Hosted migrations 000001–000008 applied successfully. Verified that anon/authenticated/PUBLIC have no application-table grants and that the Go transaction role can perform the RLS-protected read. Evidence: testing/deployment-hosted-migrations.log and testing/deployment-hosted-permissions.log.

The user explicitly approved public source publication after the initial approval-review block. Repository: https://github.com/Rohithmatham12/afterframe (default branch `codex/afterframe`).

Render service `srv-db5qsqg473hc73c3o1dg` is live at https://afterframe-api.onrender.com on the free plan with automatic backend deployments disabled. Health, TMDB search/detail, correct Pages-origin CORS and unauthenticated API rejection passed. Server credentials were transmitted only to Render environment settings. Supabase browser REST table reads were denied (deployment-data-api.json).

GitHub Pages target: https://rohithmatham12.github.io/afterframe/. The workflow uses Node 24.11.1, `/afterframe` base path and public API/Auth build variables. Supabase Site URL and exact allowed redirect were set to this address. No paid resources were created.

Initial Pages builds exposed missing optional WASM dependencies in the lockfile. Restored exact registry package metadata and validated clean install. Pages run 38152941314 completed successfully: https://github.com/Rohithmatham12/afterframe/actions/runs/38152941314.

Deployment is live. Public mobile Playwright verification passed sign-in, protected Go profile, film logging with private memory, diary reload persistence, the Settings sign-out control and account erasure. The disposable hosted Auth identity was confirmed absent afterward; no browser runtime errors occurred. Evidence: testing/deployment-browser-smoke.log. Google OAuth was previously verified locally; the production redirect is configured, but a new end-to-end Google consent journey was not repeated during this deployment.

Render Free can sleep after inactivity, so the first API request may be delayed. Backend updates require explicit Render deployment; frontend updates trigger Pages automatically. Local release limitations remain documented in testing/TEST_REPORT.md; deployment authorization is not a declaration that every original feature gate passed.
