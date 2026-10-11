# Real hosted authentication verification

Google OAuth: PASS on 2026-10-11. The separate local build uses the same Next.js components and Supabase PKCE client, hosted Supabase Auth and the real Go API at port 8081. Its application database is a separate local PostgreSQL database.

The application initiated Google authorization; the user completed Google account selection/consent. The browser returned to http://127.0.0.1:3001/ with the session established. The protected settings profile loaded through Go, and reloading preserved access to the authenticated profile form. No tokens, Google account identifiers or private profile values are saved in this evidence.

Hosted account erasure: PASS. cmd/verify-hosted created one disposable, confirmed-email Auth user without sending email, obtained a real access token, saved private data through the actual Go handler into a newly created local test database, invoked the Go deletion endpoint, verified database erasure and hosted-user absence, and confirmed rejected login/stale-token access. Its local database was dropped and disposable hosted user cleaned up. See hosted-erasure-isolated.log. The real Google user was not deleted.

No hosted application database migrations, cloud configuration changes or public deployment occurred.
