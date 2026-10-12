-- GAP 14: mute is one-directional and private — unlike block, the muted
-- person is never told and nothing about them changes; it only affects
-- what the muter sees in their own feed.
CREATE TABLE mutes (
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 target_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,target_id),
 CHECK(user_id<>target_id)
);
ALTER TABLE mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mute_owner ON mutes FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
GRANT SELECT,INSERT,DELETE ON mutes TO afterframe_api;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON mutes FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
