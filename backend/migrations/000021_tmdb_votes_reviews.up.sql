-- GAP 01: TMDB's own aggregate rating and community reviews, cached
-- alongside the rest of a film's detail data (same 24h TTL as genres,
-- runtime, certifications). Always labelled and rendered separately from
-- Afterframe's own reviews — see frontend's "TMDB rating"/"TMDB community
-- review" labels; this data is never presented as native.
ALTER TABLE films ADD COLUMN vote_average numeric(3,1) NOT NULL DEFAULT 0;
ALTER TABLE films ADD COLUMN vote_count integer NOT NULL DEFAULT 0;
ALTER TABLE films ADD COLUMN original_language text NOT NULL DEFAULT '';
ALTER TABLE films ADD COLUMN tmdb_reviews jsonb NOT NULL DEFAULT '[]';
