# Security review — local implementation

Go validates bearer sessions against Supabase Auth before protected routes. Transactions set the authenticated UUID and switch to the non-superuser afterframe_api role; PostgreSQL RLS restricts ownership. No browser service key or TMDB credential is shipped. Frontend receives only Go-filtered spoiler layers. Memories are owner-only. Profile privacy and blocks affect social reads.

Mutations reject unknown JSON fields, trailing values and oversized bodies. Rating/date/identifier validation runs in Go. SQL uses generated parameterized sqlc queries. Logs/opinions/memories/watchlist changes are atomic. Idempotency request IDs prevent duplicate viewing creation. Avatars are decoded PNG/JPEG with size/dimension limits. Account deletion cascades personal data and records a tombstone for authentication-provider retry.

Bearer authorization avoids cookie-based CSRF. CORS is an explicit origin allowlist. Responses use no-store and nosniff. Rate-limit state is bounded to 10,000 keys with a shared overflow budget. Authenticated accounts have independent budgets; the remote-address budget remains a coarse network guard. Forwarded headers are not trusted blindly.

Evidence: Go race/integration logs, real browser memory isolation, spoiler non-disclosure, private-profile checks, invalid image rejection and local account-erasure journey. Provider failure tests use isolated HTTP test servers; application browser endpoints are not mocked.

Outstanding: hosted OAuth/redirect configuration, production TLS/proxy policy, privileged-role bootstrap on Supabase, real email delivery, restoration/backups, moderation operations and abuse/load testing. No public deployment is approved. This is not a claim of production security certification.
