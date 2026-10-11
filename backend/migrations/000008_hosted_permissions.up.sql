-- Keep browser Data API roles outside the Go authorization boundary.
REVOKE ALL ON profiles, films, viewings, opinions, memories, reviews, reveals,
 watchlist, lists, list_items, follows, blocks, review_likes, list_likes,
 comments, notifications, reports, analytics, deleted_accounts FROM PUBLIC;
REVOKE ALL ON FUNCTION viewer_id(), not_blocked(uuid), profile_visible(uuid), film_card(films) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION viewer_id(), not_blocked(uuid), profile_visible(uuid), film_card(films) TO afterframe_api;
DO $$
DECLARE browser_role text;
BEGIN
 FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN
   EXECUTE format('REVOKE ALL ON profiles, films, viewings, opinions, memories, reviews, reveals, watchlist, lists, list_items, follows, blocks, review_likes, list_likes, comments, notifications, reports, analytics, deleted_accounts FROM %I', browser_role);
   EXECUTE format('REVOKE ALL ON FUNCTION viewer_id(), not_blocked(uuid), profile_visible(uuid), film_card(films) FROM %I', browser_role);
  END IF;
 END LOOP;
END $$;
GRANT afterframe_api TO CURRENT_USER;
