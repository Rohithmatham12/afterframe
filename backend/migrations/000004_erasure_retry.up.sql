ALTER TABLE deleted_accounts ADD COLUMN auth_deleted boolean NOT NULL DEFAULT false;
GRANT UPDATE ON deleted_accounts TO afterframe_api;
