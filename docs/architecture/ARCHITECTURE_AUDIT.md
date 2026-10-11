# Architecture audit

The browser is a static Next.js export with generated OpenAPI client types. All durable product operations run through Go Chi routes and Go services. Go uses pgx/sqlc with versioned migrations and transaction-local RLS. Supabase Auth is an external identity boundary; Go validates its authoritative user response. TMDB requests carry the server credential only from Go. Memory recall uses PostgreSQL full-text/trigram search; no paid AI integration is called. Taste comparisons and spoiler disclosure are Go modules.

Local infrastructure contains PostgreSQL/pgvector, GoTrue and Mailpit. Hosted targets are configuration only: GitHub Pages, Render Free and Supabase Free. Python scripts generate development configuration/specifications; they do not serve application business logic.

Eight Archify system-description diagrams passed validate/deliver/check/browser-check. These checks validate diagram artifacts, not implementation correctness. Repository-backed finalize failed because this isolated git repository has no remote identity. Source candidates and failure receipt are preserved; no remote was fabricated. Local source maps accompany the description diagrams. Sixteen concrete implementation claims now have local source spans and SHA-256 hashes in SOURCE_AUDIT.md. This closes the local source-trace check, but does not establish remote repository provenance.

No microservices, message broker, separate AI service or client-side authorization authority were introduced. Account-erasure retry is an in-process bounded worker with database tombstones.

The static public catalog snapshot improves initial rendering and is revalidated by the Go catalog API. It contains public movie metadata only. Collection reads are bounded in SQL and embedded cards omit full credits; full details remain available through Go. Query-plan evidence is recorded under docs/testing/query-plans.json.
