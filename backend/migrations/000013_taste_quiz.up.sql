-- GAP 02: personal cold start. Responses are keyed by (user,film) so a
-- retake overwrites rather than accumulates; "unseen" is stored distinctly
-- from "dislike" and must never be scored as a dislike (see internal/taste).
CREATE TABLE taste_quiz_responses (
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 film_id bigint NOT NULL REFERENCES films,
 response text NOT NULL CHECK(response IN ('like','dislike','unseen')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,film_id)
);
ALTER TABLE taste_quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY taste_quiz_owner ON taste_quiz_responses FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON taste_quiz_responses TO afterframe_api;

-- Null until the quiz is completed at least once; lets the frontend decide
-- whether to offer it without re-prompting someone who already finished it.
ALTER TABLE profiles ADD COLUMN quiz_completed_at timestamptz;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON taste_quiz_responses FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
