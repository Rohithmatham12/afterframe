CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS profiles (
 id uuid PRIMARY KEY, username text NOT NULL UNIQUE CHECK(username ~ '^[a-z0-9_]{3,30}$'),
 name text NOT NULL DEFAULT '', bio text NOT NULL DEFAULT '', avatar text NOT NULL DEFAULT '',
 private boolean NOT NULL DEFAULT false, resurface boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE films (id bigint PRIMARY KEY, title text NOT NULL, year text NOT NULL DEFAULT '', poster text NOT NULL DEFAULT '', backdrop text NOT NULL DEFAULT '', overview text NOT NULL DEFAULT '', genres text[] NOT NULL DEFAULT '{}', director text NOT NULL DEFAULT '', runtime integer NOT NULL DEFAULT 0, cached_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE viewings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, film_id bigint NOT NULL REFERENCES films, watched_on date NOT NULL, rating numeric(2,1) CHECK (rating BETWEEN .5 AND 5 AND mod(rating*2,1)=0), notes text NOT NULL DEFAULT '', rewatch boolean NOT NULL DEFAULT false, private boolean NOT NULL DEFAULT false, request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_id));
CREATE INDEX viewings_owner_date ON viewings(user_id,watched_on DESC);
CREATE TABLE opinions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, film_id bigint NOT NULL REFERENCES films, viewing_id uuid REFERENCES viewings ON DELETE SET NULL, rating numeric(2,1) CHECK (rating BETWEEN .5 AND 5 AND mod(rating*2,1)=0), reflection text NOT NULL DEFAULT '', kind text NOT NULL CHECK(kind IN ('initial','reflection','rewatch','correction')), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX opinions_history ON opinions(user_id,film_id,created_at DESC,id);
CREATE TABLE memories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, viewing_id uuid NOT NULL UNIQUE REFERENCES viewings ON DELETE CASCADE, scene text NOT NULL DEFAULT '', emotion text NOT NULL DEFAULT '', context text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(), search tsvector GENERATED ALWAYS AS (to_tsvector('english',scene || ' ' || emotion || ' ' || context)) STORED);
CREATE INDEX memories_search ON memories USING gin(search);
CREATE INDEX memories_fuzzy ON memories USING gin((scene || ' ' || emotion || ' ' || context) gin_trgm_ops);
CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, film_id bigint NOT NULL REFERENCES films, safe text NOT NULL DEFAULT '', watched text NOT NULL DEFAULT '', reflection text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE reveals (user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, film_id bigint NOT NULL REFERENCES films, layer integer NOT NULL CHECK(layer BETWEEN 1 AND 3), PRIMARY KEY(user_id,film_id));
CREATE TABLE watchlist (user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, film_id bigint NOT NULL REFERENCES films, private boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,film_id));
CREATE TABLE lists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), description text NOT NULL DEFAULT '', private boolean NOT NULL DEFAULT false, ranked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE list_items (list_id uuid NOT NULL REFERENCES lists ON DELETE CASCADE, film_id bigint NOT NULL REFERENCES films, position integer NOT NULL CHECK(position>=0), PRIMARY KEY(list_id,film_id), UNIQUE(list_id,position) DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE follows (user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, target_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, PRIMARY KEY(user_id,target_id), CHECK(user_id<>target_id));
CREATE TABLE blocks (user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, target_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, PRIMARY KEY(user_id,target_id), CHECK(user_id<>target_id));
CREATE TABLE review_likes (user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, review_id uuid NOT NULL REFERENCES reviews ON DELETE CASCADE, PRIMARY KEY(user_id,review_id));
CREATE TABLE list_likes (user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, list_id uuid NOT NULL REFERENCES lists ON DELETE CASCADE, PRIMARY KEY(user_id,list_id));
CREATE TABLE comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, review_id uuid NOT NULL REFERENCES reviews ON DELETE CASCADE, body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000), layer integer NOT NULL CHECK(layer BETWEEN 1 AND 3), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, kind text NOT NULL, object_id text NOT NULL DEFAULT '', read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, subject text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE analytics (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES profiles ON DELETE CASCADE, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
-- Defense in depth. Go sets transaction-local app.user_id for every application query.
CREATE FUNCTION viewer_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
CREATE FUNCTION not_blocked(other uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT NOT EXISTS (SELECT 1 FROM blocks WHERE (user_id=viewer_id() AND target_id=other) OR (user_id=other AND target_id=viewer_id())) $$;
CREATE FUNCTION profile_visible(other uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT other=viewer_id() OR EXISTS(SELECT 1 FROM profiles WHERE id=other AND NOT private AND not_blocked(other)) $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','viewings','opinions','memories','reviews','reveals','watchlist','lists','list_items','follows','blocks','review_likes','list_likes','comments','notifications','reports','analytics'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
CREATE POLICY profile_read ON profiles FOR SELECT USING(id=viewer_id() OR (NOT private AND not_blocked(id)));
CREATE POLICY profile_write ON profiles FOR ALL USING(id=viewer_id()) WITH CHECK(id=viewer_id());
CREATE POLICY viewing_read ON viewings FOR SELECT USING(user_id=viewer_id() OR (NOT private AND profile_visible(user_id)));
CREATE POLICY viewing_write ON viewings FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY opinion_owner ON opinions FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY memory_owner ON memories FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY reveal_owner ON reveals FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY watch_read ON watchlist FOR SELECT USING(user_id=viewer_id() OR (NOT private AND profile_visible(user_id)));
CREATE POLICY watch_write ON watchlist FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY list_read ON lists FOR SELECT USING(user_id=viewer_id() OR (NOT private AND profile_visible(user_id)));
CREATE POLICY list_write ON lists FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY review_read ON reviews FOR SELECT USING(profile_visible(user_id));
CREATE POLICY review_write ON reviews FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY block_owner ON blocks FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY follow_read ON follows FOR SELECT USING(profile_visible(user_id) AND profile_visible(target_id));
CREATE POLICY follow_write ON follows FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
CREATE POLICY notification_owner ON notifications FOR SELECT USING(user_id=viewer_id());
CREATE POLICY report_owner ON reports FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
-- Supabase browser roles must never access raw review layers or application tables.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon; END IF; IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated; END IF; END $$;
