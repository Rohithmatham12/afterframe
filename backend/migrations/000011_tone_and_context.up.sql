-- GAP 09: author-selected review tone, so thoughtful analysis isn't buried
-- under jokes. No automatic classification: the author picks, or leaves blank.
ALTER TABLE reviews ADD COLUMN tone text NOT NULL DEFAULT '' CHECK(tone IN ('','insightful','funny'));

-- GAP 19: who/why someone watched, captured at logging time. Basic version:
-- one tag per viewing. Persistent per-context preference profiles are Phase 2.
ALTER TABLE viewings ADD COLUMN context text NOT NULL DEFAULT '' CHECK(context IN ('','solo','date_night','friends','family','kids'));
