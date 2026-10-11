# Supabase configuration repair

The project URL supplied by the user was correct. Root `.env` contained Markdown link syntax as the value, which neither the check script nor Go dotenv converts to a URL. Replaced only that assignment with its plain HTTPS URL; retained file mode 0600. No credentials are included in this report.

Loading order:
- Go API/migrator: inherited process environment takes precedence over `godotenv.Load("../.env")`. No inherited SUPABASE_URL was present in the inspected shell.
- Only AFTERFRAME_LOCAL=1 invokes `godotenv.Overload("../.env.local")`, intentionally targeting isolated local GoTrue/PostgreSQL.
- Local frontend generator intentionally merges root .env then .env.local and writes matching public values to frontend/.env.local. No extra frontend production env files were found.
- Hosted connectivity script reads root .env directly, now resolves its path independently of the caller's working directory, rejects malformed/Markdown URLs clearly, and exits unsuccessfully on provider failures.

Read-only verification: TMDB HTTP 200; Supabase Auth settings HTTP 200; Google provider enabled. No hosted users, database records, OAuth settings or cloud infrastructure changed. Full browser Google OAuth and hosted account deletion are separate pending release checks.

The actual Go godotenv loader also resolved the corrected hosted URL, the Go HTTP client received HTTP 200, and explicitly applying the local override still selected isolated local Auth.
