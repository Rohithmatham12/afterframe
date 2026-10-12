-- Bypasses the profile_read RLS policy for a pure existence check so a private
-- profile's username still counts as taken; returns no other information.
CREATE FUNCTION username_taken(u text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM profiles WHERE username=u AND id<>viewer_id())
$$;
REVOKE ALL ON FUNCTION username_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION username_taken(text) TO afterframe_api;
DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION username_taken(text) FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
