-- Intentionally retain the browser access revocations on rollback.
-- Restoring raw-table access would bypass Go spoiler and authorization policies.
SELECT 1;
