-- GAP 04: feelings are per viewing-event, not per film, so the same film can
-- carry different emotions across separate (re)watches.
CREATE TABLE viewing_feelings (
 viewing_id uuid NOT NULL REFERENCES viewings ON DELETE CASCADE,
 feeling text NOT NULL CHECK(feeling IN ('comforted','wrecked','inspired','energized','nostalgic','uneasy','hopeful','melancholic','amused','thoughtful','frustrated','calm','amazed')),
 PRIMARY KEY(viewing_id,feeling)
);
ALTER TABLE viewing_feelings ENABLE ROW LEVEL SECURITY;
CREATE POLICY viewing_feelings_read ON viewing_feelings FOR SELECT USING(EXISTS(SELECT 1 FROM viewings v WHERE v.id=viewing_id AND (v.user_id=viewer_id() OR (NOT v.private AND profile_visible(v.user_id)))));
CREATE POLICY viewing_feelings_write ON viewing_feelings FOR ALL USING(EXISTS(SELECT 1 FROM viewings v WHERE v.id=viewing_id AND v.user_id=viewer_id())) WITH CHECK(EXISTS(SELECT 1 FROM viewings v WHERE v.id=viewing_id AND v.user_id=viewer_id()));
GRANT SELECT,INSERT,UPDATE,DELETE ON viewing_feelings TO afterframe_api;
-- Mirror migration 000008: any Supabase Data API role must stay outside the Go
-- authorization boundary for every application table, new ones included.
DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON viewing_feelings FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;

-- GAP 07: watchlist intent, captured at save time so a forgotten watchlist
-- entry can be resurfaced by the reason it was saved, not just its date.
ALTER TABLE watchlist ADD COLUMN intent text NOT NULL DEFAULT '' CHECK(intent IN ('','date_night','rainy_day','friends_recommended','family_night','weekend','comfort_watch','short_movie','personal_recommendation'));
ALTER TABLE watchlist ADD COLUMN intent_note text NOT NULL DEFAULT '' CHECK(length(intent_note)<=200);
