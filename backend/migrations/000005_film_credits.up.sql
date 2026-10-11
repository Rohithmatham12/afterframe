ALTER TABLE films ADD COLUMN cast_members jsonb NOT NULL DEFAULT '[]', ADD COLUMN crew jsonb NOT NULL DEFAULT '[]';
UPDATE films SET cached_at='1970-01-01';
