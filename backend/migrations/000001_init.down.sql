DROP TABLE IF EXISTS analytics,reports,notifications,comments,list_likes,review_likes,blocks,follows,list_items,lists,watchlist,reveals,reviews,memories,opinions,viewings,films,profiles CASCADE;
DROP FUNCTION IF EXISTS profile_visible(uuid),not_blocked(uuid),viewer_id();
