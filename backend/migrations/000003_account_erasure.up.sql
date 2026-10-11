CREATE TABLE deleted_accounts (user_id uuid PRIMARY KEY, deleted_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE deleted_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY deleted_owner ON deleted_accounts FOR ALL USING(user_id=viewer_id()) WITH CHECK(user_id=viewer_id());
GRANT SELECT,INSERT ON deleted_accounts TO afterframe_api;
