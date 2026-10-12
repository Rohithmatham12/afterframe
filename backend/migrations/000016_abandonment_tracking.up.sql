-- GAP 20: partial-viewing signal, stored separately from a completed watch
-- (viewings/opinions) so an abandoned film is never counted as finished and
-- never automatically scored as a dislike.
CREATE TABLE viewing_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 film_id bigint NOT NULL REFERENCES films,
 status text NOT NULL CHECK(status IN ('started','paused','abandoned')),
 progress_minutes integer CHECK(progress_minutes IS NULL OR progress_minutes>=0),
 reason text CHECK(reason IS NULL OR reason IN ('bored','not_in_the_mood','too_intense','interrupted','other')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,film_id)
);
ALTER TABLE viewing_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY viewing_progress_owner ON viewing_progress FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON viewing_progress TO afterframe_api;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON viewing_progress FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
