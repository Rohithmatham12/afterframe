-- GAP 18: Family Mode is a discovery/recommendation filter the account
-- owner opts into, never a parental-control or child-account system (that
-- would need a separate, legally-reviewed design). family_policy='' means
-- off; a chosen policy persists on the profile so it can't be silently
-- bypassed per-request the way a client-supplied flag could be.
ALTER TABLE profiles ADD COLUMN family_policy text NOT NULL DEFAULT '' CHECK(family_policy IN ('','strict','standard'));
ALTER TABLE profiles ADD COLUMN family_region text NOT NULL DEFAULT 'US';
-- Region-keyed certification snapshot, cached alongside the rest of a
-- film's detail data (genres, runtime) with the same lifecycle/TTL.
ALTER TABLE films ADD COLUMN certifications jsonb NOT NULL DEFAULT '{}';
