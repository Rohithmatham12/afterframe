-- GAP 24 (partial, free-tier only): current region-specific streaming
-- availability via TMDB's watch/providers endpoint (JustWatch-sourced data).
-- No predicted departure dates are ever stored here — only an observed
-- snapshot per film+region, refreshed lazily, with a verified change log.
-- Not RLS-scoped to a user: this is shared catalog data, same as `films`.
CREATE TABLE film_availability (
 film_id bigint NOT NULL REFERENCES films,
 region text NOT NULL CHECK(region ~ '^[A-Z]{2}$'),
 providers text[] NOT NULL DEFAULT '{}',
 source text NOT NULL DEFAULT 'tmdb',
 fetched_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(film_id,region)
);
GRANT SELECT,INSERT,UPDATE ON film_availability TO afterframe_api;

-- Per-user alerts when a watchlisted film's availability actually changes.
-- Deliberately separate from `notifications`: there is no human actor, so it
-- does not fit that table's actor_id/not_blocked model.
CREATE TABLE availability_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 film_id bigint NOT NULL REFERENCES films,
 region text NOT NULL,
 provider text NOT NULL,
 change text NOT NULL CHECK(change IN ('added','removed')),
 read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE availability_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY availability_alert_read ON availability_alerts FOR SELECT USING(user_id=viewer_id());
-- Insert has no per-row CHECK: the recipient list is computed server-side from
-- watchlist + opt-in, not from client input, and only afterframe_api can ever
-- reach this table at all (anon/authenticated are revoked below).
CREATE POLICY availability_alert_write ON availability_alerts FOR INSERT WITH CHECK(true);
CREATE POLICY availability_alert_update ON availability_alerts FOR UPDATE USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
GRANT SELECT,INSERT,UPDATE ON availability_alerts TO afterframe_api;

ALTER TABLE profiles ADD COLUMN notify_availability boolean NOT NULL DEFAULT false;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON film_availability, availability_alerts FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
