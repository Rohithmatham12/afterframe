-- Compact embedded movie cards; full credits remain available on film detail.
CREATE FUNCTION film_card(f films) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',f.id,'title',f.title,'year',f.year,'poster',f.poster,'backdrop',f.backdrop,'genres',f.genres,'director',f.director,'runtime',f.runtime,'overview','','cast_members','[]'::jsonb,'crew','[]'::jsonb)
$$;
CREATE INDEX lists_owner_date ON lists(user_id,created_at DESC);
CREATE INDEX watchlist_owner_date ON watchlist(user_id,created_at DESC);
