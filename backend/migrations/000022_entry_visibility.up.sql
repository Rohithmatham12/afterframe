-- GAP 11: a real 3-tier Private/Followers/Public visibility for diary
-- logging, replacing the binary private/not-private model. "Followers,"
-- not "Friends" — this app only has a one-way follow relationship, and the
-- spec is explicit that the label must say what the relationship actually
-- is. Default stays Private, same conservative default as before.
ALTER TABLE viewings ADD COLUMN visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','followers','public'));
UPDATE viewings SET visibility = CASE WHEN private THEN 'private' ELSE 'public' END;

DROP POLICY viewing_read ON viewings;
CREATE POLICY viewing_read ON viewings FOR SELECT USING(
 user_id=viewer_id()
 OR (visibility='public' AND profile_visible(user_id))
 OR (visibility='followers' AND profile_visible(user_id) AND EXISTS(SELECT 1 FROM follows WHERE user_id=viewer_id() AND target_id=viewings.user_id))
);

-- viewing_feelings_read (migration 000010) also depends on viewings.private
-- and must be updated before the column can be dropped.
DROP POLICY viewing_feelings_read ON viewing_feelings;
CREATE POLICY viewing_feelings_read ON viewing_feelings FOR SELECT USING(
 EXISTS(SELECT 1 FROM viewings v WHERE v.id=viewing_id AND (
  v.user_id=viewer_id()
  OR (v.visibility='public' AND profile_visible(v.user_id))
  OR (v.visibility='followers' AND profile_visible(v.user_id) AND EXISTS(SELECT 1 FROM follows WHERE user_id=viewer_id() AND target_id=v.user_id))
 ))
);

ALTER TABLE viewings DROP COLUMN private;
