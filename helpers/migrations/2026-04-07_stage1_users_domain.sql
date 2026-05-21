BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;

UPDATE users
SET
  is_active = COALESCE(is_active, TRUE),
  must_change_password = COALESCE(must_change_password, FALSE)
WHERE is_active IS DISTINCT FROM COALESCE(is_active, TRUE)
   OR must_change_password IS DISTINCT FROM COALESCE(must_change_password, FALSE);

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_setor_active ON users(setor_id, is_active);

COMMIT;
