-- GAP 08 completion: real consent for a second *Afterframe account* in
-- Tonight Mode (the guest path needed none of this). Also the foundation
-- for GAP 25 (taste compatibility) — same mutual-consent primitive, reused
-- rather than rebuilt.
CREATE TABLE taste_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 responded_at timestamptz,
 CHECK(requester_id<>partner_id),
 UNIQUE(requester_id,partner_id)
);
ALTER TABLE taste_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY taste_share_read ON taste_shares FOR SELECT USING(requester_id=viewer_id() OR partner_id=viewer_id());
CREATE POLICY taste_share_insert ON taste_shares FOR INSERT WITH CHECK(requester_id=viewer_id() AND not_blocked(partner_id));
CREATE POLICY taste_share_respond ON taste_shares FOR UPDATE USING(partner_id=viewer_id()) WITH CHECK(partner_id=viewer_id());
GRANT SELECT,INSERT,UPDATE ON taste_shares TO afterframe_api;

-- Bypasses the quiz_responses owner-only RLS for the one case that should
-- cross the boundary: a mutually accepted share. Re-checks consent itself,
-- so it stays safe even if a caller skips the separate existence check.
CREATE FUNCTION shared_taste(partner uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(t.*)||jsonb_build_object('film',film_card(f))),'[]'::jsonb)
 FROM taste_quiz_responses t JOIN films f ON f.id=t.film_id
 WHERE t.user_id=partner
 AND EXISTS(SELECT 1 FROM taste_shares WHERE status='accepted' AND ((requester_id=viewer_id() AND partner_id=partner) OR (requester_id=partner AND partner_id=viewer_id())))
$$;
REVOKE ALL ON FUNCTION shared_taste(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_taste(uuid) TO afterframe_api;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON taste_shares FROM %I', browser_role);
   EXECUTE format('REVOKE ALL ON FUNCTION shared_taste(uuid) FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
