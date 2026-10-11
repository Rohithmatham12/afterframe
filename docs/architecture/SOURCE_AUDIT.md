# Local source audit

Snapshot: working tree; base commit 13e76d7f687fb31f6a7498a015bfc24532270961. SHA-256 hashes pin the inspected bytes. Remote-backed Archify provenance remains unavailable because no remote repository exists.

- Static frontend delegates to generated API client: `frontend/lib/api.ts:4`–`15`.
- Go routes own authentication and authorization: `backend/internal/httpapi/api.go:67`–`84`.
- Auth validates bearer tokens with authoritative provider: `backend/internal/auth/auth.go:25`–`53`.
- Every service transaction sets viewer and database role: `backend/internal/service/service.go:79`–`105`.
- Atomic film logging appends opinions and memories: `backend/internal/service/service.go:392`–`459`.
- TMDB requests carry server credentials only: `backend/internal/catalog/catalog.go:79`–`103`.
- Memory search is owner-scoped PostgreSQL FTS and fuzzy matching: `backend/queries/app.sql:46`–`54`.
- Timeline comparison belongs to Go: `backend/internal/taste/insights.go:28`–`54`.
- Forbidden spoiler fields are removed before serialization: `backend/internal/spoilers/policy.go:4`–`12`.
- Review and feed reads invoke the same disclosure policy: `backend/internal/service/service.go:187`–`206`.
- Social writes execute within the owner transaction: `backend/internal/service/service.go:311`–`355`.
- Account erasure commits private deletion and durable tombstone: `backend/internal/service/account.go:14`–`27`.
- Auth erasure retries are bounded and durable: `backend/internal/service/account.go:41`–`55`.
- Database uses RLS and role-scoped permissions: `backend/migrations/000002_security.up.sql:1`–`16`.
- Deployment configuration targets Render Free without auto deploy: `render.yaml:6`–`12`.
- GitHub workflow builds a static Pages artifact without deploying: `.github/workflows/pages.yml:1`–`28`.
