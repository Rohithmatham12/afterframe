ALTER TABLE viewings ADD COLUMN private boolean NOT NULL DEFAULT true;
UPDATE viewings SET private = (visibility <> 'public');
DROP POLICY viewing_feelings_read ON viewing_feelings;
CREATE POLICY viewing_feelings_read ON viewing_feelings FOR SELECT USING(EXISTS(SELECT 1 FROM viewings v WHERE v.id=viewing_id AND (v.user_id=viewer_id() OR (NOT v.private AND profile_visible(v.user_id)))));
DROP POLICY viewing_read ON viewings;
CREATE POLICY viewing_read ON viewings FOR SELECT USING(user_id=viewer_id() OR (NOT private AND profile_visible(user_id)));
ALTER TABLE viewings DROP COLUMN visibility;
