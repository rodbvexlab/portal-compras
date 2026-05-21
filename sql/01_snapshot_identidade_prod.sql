BEGIN;

CREATE SCHEMA IF NOT EXISTS mig_identity_preserve;

DROP TABLE IF EXISTS mig_identity_preserve.snapshot_user_passwords;
DROP TABLE IF EXISTS mig_identity_preserve.snapshot_users;

CREATE TABLE mig_identity_preserve.snapshot_users AS
SELECT
  id,
  lower(trim(email)) AS email_norm,
  email,
  display_name,
  avatar_url,
  role,
  setor_id,
  is_active,
  must_change_password,
  last_login_at,
  created_at,
  updated_at,
  created_by,
  updated_by
FROM public.users;

ALTER TABLE mig_identity_preserve.snapshot_users
  ADD CONSTRAINT snapshot_users_email_norm_key UNIQUE (email_norm);

CREATE TABLE mig_identity_preserve.snapshot_user_passwords AS
SELECT
  up.id,
  up.user_id,
  lower(trim(u.email)) AS email_norm,
  up.password_hash,
  up.created_at
FROM public.user_passwords up
JOIN public.users u
  ON u.id = up.user_id;

ALTER TABLE mig_identity_preserve.snapshot_user_passwords
  ADD CONSTRAINT snapshot_user_passwords_email_norm_key UNIQUE (email_norm);

COMMIT;