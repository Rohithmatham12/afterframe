-- GAP 10: tribes are a fixed, product-curated list of regional/interest
-- communities (see taste.Tribes in Go — not a user-editable table, so
-- there is no tribe-creation or content-moderation surface to build:
-- joining only changes whose *existing* ratings get averaged together,
-- nothing else). Membership is opt-in and private — never inferred from
-- viewing history, never exposed to other users — since a regional/
-- linguistic tribe (e.g. "Tamil cinema") can itself be a sensitive
-- personal-identity signal, which the spec explicitly says not to infer
-- or expose.
CREATE TABLE user_tribes (
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 tribe_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,tribe_id)
);
ALTER TABLE user_tribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_tribes_owner ON user_tribes FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
GRANT SELECT,INSERT,DELETE ON user_tribes TO afterframe_api;

-- Both rating functions bypass viewings' owner/private RLS (SECURITY
-- DEFINER, running as the table owner) deliberately: a global or tribe
-- rating is an aggregate across *everyone*, private viewers included, and
-- returns only avg+count — never a row, so no individual rating or
-- identity is ever exposed. "Users cannot manipulate scores by submitting
-- duplicate ratings": DISTINCT ON (user_id) keeps exactly one (their most
-- recent) rating per user, so rewatching and re-rating the same film many
-- times never gives one person extra weight in the average.
CREATE FUNCTION global_rating(f bigint) RETURNS TABLE(avg_rating numeric, sample_size bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT avg(rating), count(*) FROM (
  SELECT DISTINCT ON (user_id) rating FROM viewings WHERE film_id=f AND rating IS NOT NULL ORDER BY user_id, created_at DESC
 ) x
$$;
CREATE FUNCTION tribe_rating(f bigint, tr text) RETURNS TABLE(avg_rating numeric, sample_size bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT avg(x.rating), count(*) FROM (
  SELECT DISTINCT ON (v.user_id) v.rating FROM viewings v JOIN user_tribes t ON t.user_id=v.user_id AND t.tribe_id=tr WHERE v.film_id=f AND v.rating IS NOT NULL ORDER BY v.user_id, v.created_at DESC
 ) x
$$;
REVOKE ALL ON FUNCTION global_rating(bigint), tribe_rating(bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION global_rating(bigint), tribe_rating(bigint,text) TO afterframe_api;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON user_tribes FROM %I', browser_role);
   EXECUTE format('REVOKE ALL ON FUNCTION global_rating(bigint), tribe_rating(bigint,text) FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
