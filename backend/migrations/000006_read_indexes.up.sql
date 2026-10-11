CREATE INDEX reviews_film_date ON reviews(film_id,created_at DESC);
CREATE INDEX reviews_author_date ON reviews(user_id,created_at DESC);
CREATE INDEX notifications_recipient_date ON notifications(user_id,created_at DESC);
CREATE INDEX memories_owner ON memories(user_id);
CREATE INDEX viewings_owner_film ON viewings(user_id,film_id);
CREATE INDEX follows_target ON follows(target_id);
CREATE INDEX comments_review_layer_date ON comments(review_id,layer,created_at);
