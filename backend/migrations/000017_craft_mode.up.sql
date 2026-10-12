-- GAP 17: Craft Mode is a strictly optional layer of filmmaking-technique
-- observations, kept separate from reviews/opinions so writing one never
-- requires the other. Visibility mirrors viewings (owner always, everyone
-- else only when not private); spoiler gating is handled in the read query
-- and Go service layer, reusing the same `reveals` consent table reviews
-- already use — a viewer who revealed layer 2+ for a film, or who has
-- watched it themselves, sees spoiler-marked craft notes for it too.
CREATE TABLE craft_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 film_id bigint NOT NULL REFERENCES films,
 viewing_id uuid REFERENCES viewings ON DELETE SET NULL,
 category text NOT NULL CHECK(category IN ('cinematography','editing','sound_design','production_design','direction','performance','scene_reference','other')),
 scene text NOT NULL DEFAULT '',
 body text NOT NULL DEFAULT '',
 spoiler boolean NOT NULL DEFAULT false,
 private boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 search tsvector GENERATED ALWAYS AS (to_tsvector('english', scene || ' ' || body || ' ' || category)) STORED
);
CREATE INDEX craft_notes_film ON craft_notes(film_id);
CREATE INDEX craft_notes_search ON craft_notes USING GIN(search);
ALTER TABLE craft_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY craft_notes_read ON craft_notes FOR SELECT USING(user_id=viewer_id() OR (NOT private AND profile_visible(user_id)));
CREATE POLICY craft_notes_insert ON craft_notes FOR INSERT WITH CHECK(user_id=viewer_id());
CREATE POLICY craft_notes_update ON craft_notes FOR UPDATE USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY craft_notes_delete ON craft_notes FOR DELETE USING(user_id=viewer_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON craft_notes TO afterframe_api;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON craft_notes FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
