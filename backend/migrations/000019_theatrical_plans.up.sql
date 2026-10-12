-- GAP 23: group theatrical planning. No $0-cost provider supplies real
-- showtimes (Fandango/AMC/etc. ticketing APIs are all paid partnerships;
-- scraping a restricted ticketing site is explicitly forbidden by the
-- spec), so "slots" are plans' own proposed meeting times — free text the
-- group agrees on, never presented as a verified showtime. See
-- `catalog.ShowtimeProvider` for the seam a future legitimate integration
-- would plug into.
CREATE TABLE theatrical_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 film_id bigint NOT NULL REFERENCES films,
 creator_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 note text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'planning' CHECK(status IN ('planning','decided','cancelled')),
 decided_slot_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE plan_slots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plan_id uuid NOT NULL REFERENCES theatrical_plans ON DELETE CASCADE,
 label text NOT NULL CHECK(length(label)>0 AND length(label)<=200),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE theatrical_plans ADD CONSTRAINT theatrical_plans_decided_slot_fkey FOREIGN KEY (decided_slot_id) REFERENCES plan_slots ON DELETE SET NULL;
CREATE TABLE plan_participants (
 plan_id uuid NOT NULL REFERENCES theatrical_plans ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','joined','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(plan_id,user_id)
);
CREATE TABLE plan_votes (
 slot_id uuid NOT NULL REFERENCES plan_slots ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(slot_id,user_id)
);

-- theatrical_plans and plan_participants each need to know about the other
-- to decide visibility (a plan is visible to its creator and its invited
-- participants; a participant row is visible to the creator and to that
-- participant). A plain cross-table subquery in each policy would re-enter
-- the other table's RLS and either recurse or (worse) silently misjudge
-- WITH CHECK during INSERT...RETURNING, since the policy evaluator doesn't
-- treat the two tables' policies as a fixed point the way application code
-- would. SECURITY DEFINER functions sidestep this the same way
-- not_blocked()/profile_visible() already do elsewhere in this schema: they
-- run as the table owner, which bypasses RLS entirely, so a lookup through
-- one of these functions never re-enters another table's policy.
CREATE FUNCTION is_plan_creator(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM theatrical_plans WHERE id=p AND creator_id=viewer_id())
$$;
CREATE FUNCTION is_plan_participant(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM plan_participants WHERE plan_id=p AND user_id=viewer_id())
$$;
-- plan_member composes the two for the tables that reference *neither* of
-- plan_participants/theatrical_plans in their own policies (plan_slots,
-- plan_votes) — safe to use freely there, since it can't create a cycle.
CREATE FUNCTION plan_member(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT is_plan_creator(p) OR is_plan_participant(p)
$$;
-- A plan's full participant roster, for the one UI surface that needs every
-- participant to see every other participant (not just their own row) —
-- same pattern as shared_taste(): a single SECURITY DEFINER entry point
-- that checks membership itself and returns data directly, rather than a
-- table policy that would have to self-reference plan_participants.
CREATE FUNCTION plan_roster(p uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN is_plan_creator(p) OR is_plan_participant(p) THEN
  coalesce((SELECT jsonb_agg(to_jsonb(pp.*)||jsonb_build_object('username',prof.username) ORDER BY pp.created_at)
            FROM plan_participants pp JOIN profiles prof ON prof.id=pp.user_id WHERE pp.plan_id=p),'[]'::jsonb)
  ELSE '[]'::jsonb END
$$;

ALTER TABLE theatrical_plans ENABLE ROW LEVEL SECURITY;
-- Reads directly from plan_participants here (not is_plan_participant) are
-- fine: that's a *different* table than the one this policy guards, so it
-- can't be the self-reference that breaks RETURNING.
CREATE POLICY theatrical_plans_read ON theatrical_plans FOR SELECT USING(
 creator_id=viewer_id() OR EXISTS(SELECT 1 FROM plan_participants WHERE plan_id=id AND user_id=viewer_id())
);
CREATE POLICY theatrical_plans_insert ON theatrical_plans FOR INSERT WITH CHECK(creator_id=viewer_id());
CREATE POLICY theatrical_plans_update ON theatrical_plans FOR UPDATE USING(creator_id=viewer_id()) WITH CHECK(creator_id=viewer_id());
GRANT SELECT,INSERT,UPDATE ON theatrical_plans TO afterframe_api;

ALTER TABLE plan_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_slots_read ON plan_slots FOR SELECT USING(plan_member(plan_id));
CREATE POLICY plan_slots_insert ON plan_slots FOR INSERT WITH CHECK(is_plan_creator(plan_id));
GRANT SELECT,INSERT ON plan_slots TO afterframe_api;

ALTER TABLE plan_participants ENABLE ROW LEVEL SECURITY;
-- is_plan_creator here (not a plain subquery) is what breaks the cycle with
-- theatrical_plans_read above.
CREATE POLICY plan_participants_read ON plan_participants FOR SELECT USING(user_id=viewer_id() OR is_plan_creator(plan_id));
CREATE POLICY plan_participants_insert ON plan_participants FOR INSERT WITH CHECK(is_plan_creator(plan_id) AND not_blocked(user_id));
CREATE POLICY plan_participants_respond ON plan_participants FOR UPDATE USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
GRANT SELECT,INSERT,UPDATE ON plan_participants TO afterframe_api;

ALTER TABLE plan_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_votes_read ON plan_votes FOR SELECT USING(EXISTS(SELECT 1 FROM plan_slots s WHERE s.id=slot_id AND plan_member(s.plan_id)));
CREATE POLICY plan_votes_insert ON plan_votes FOR INSERT WITH CHECK(
 user_id=viewer_id() AND EXISTS(SELECT 1 FROM plan_slots s WHERE s.id=slot_id AND is_plan_participant(s.plan_id))
);
CREATE POLICY plan_votes_delete ON plan_votes FOR DELETE USING(user_id=viewer_id());
GRANT SELECT,INSERT,DELETE ON plan_votes TO afterframe_api;

REVOKE ALL ON FUNCTION is_plan_creator(uuid), is_plan_participant(uuid), plan_member(uuid), plan_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_plan_creator(uuid), is_plan_participant(uuid), plan_member(uuid), plan_roster(uuid) TO afterframe_api;

DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON theatrical_plans FROM %I', browser_role);
   EXECUTE format('REVOKE ALL ON plan_slots FROM %I', browser_role);
   EXECUTE format('REVOKE ALL ON plan_participants FROM %I', browser_role);
   EXECUTE format('REVOKE ALL ON plan_votes FROM %I', browser_role);
   EXECUTE format('REVOKE ALL ON FUNCTION is_plan_creator(uuid), is_plan_participant(uuid), plan_member(uuid), plan_roster(uuid) FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
