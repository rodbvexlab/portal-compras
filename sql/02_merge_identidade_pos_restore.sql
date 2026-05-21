BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

/* Prechecks */
DO $$
BEGIN
  IF current_database() <> 'portal_compras' THEN
    RAISE EXCEPTION 'Banco incorreto: %, esperado portal_compras', current_database();
  END IF;

  IF to_regclass('mig_identity_preserve.snapshot_users') IS NULL THEN
    RAISE EXCEPTION 'Snapshot mig_identity_preserve.snapshot_users não encontrado.';
  END IF;

  IF to_regclass('mig_identity_preserve.snapshot_user_passwords') IS NULL THEN
    RAISE EXCEPTION 'Snapshot mig_identity_preserve.snapshot_user_passwords não encontrado.';
  END IF;

  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.users não encontrada.';
  END IF;

  IF to_regclass('public.user_passwords') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.user_passwords não encontrada.';
  END IF;
END $$;

/* 1) Atualizar usuários existentes por e-mail */
UPDATE public.users u
SET
  display_name = s.display_name,
  email = s.email,
  avatar_url = s.avatar_url,
  role = s.role,
  setor_id = s.setor_id,
  is_active = s.is_active,
  must_change_password = s.must_change_password,
  last_login_at = s.last_login_at,
  updated_at = COALESCE(s.updated_at, now())
FROM mig_identity_preserve.snapshot_users s
WHERE lower(trim(u.email)) = s.email_norm;

/* 2) Inserir usuários da produção que não existirem na homologação restaurada */
INSERT INTO public.users (
  display_name,
  email,
  avatar_url,
  role,
  setor_id,
  created_at,
  updated_at,
  is_active,
  must_change_password,
  last_login_at,
  created_by,
  updated_by
)
SELECT
  s.display_name,
  s.email,
  s.avatar_url,
  s.role,
  s.setor_id,
  COALESCE(s.created_at, now()),
  COALESCE(s.updated_at, now()),
  COALESCE(s.is_active, true),
  COALESCE(s.must_change_password, false),
  s.last_login_at,
  NULL,
  NULL
FROM mig_identity_preserve.snapshot_users s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users u
  WHERE lower(trim(u.email)) = s.email_norm
);

/* 3) Aplicar/atualizar hash de senha dos usuários preservados */
INSERT INTO public.user_passwords (
  user_id,
  password_hash,
  created_at
)
SELECT
  u.id,
  sp.password_hash,
  COALESCE(sp.created_at, now())
FROM mig_identity_preserve.snapshot_user_passwords sp
JOIN public.users u
  ON lower(trim(u.email)) = sp.email_norm
ON CONFLICT (user_id)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  created_at = EXCLUDED.created_at;

/* 4) Limpar artefatos transitórios */
TRUNCATE TABLE public.sessions RESTART IDENTITY;
TRUNCATE TABLE public.login_attempts RESTART IDENTITY;

/* 5) Ajustar sequences principais */
SELECT setval(
  pg_get_serial_sequence('public.users', 'id'),
  COALESCE((SELECT max(id) FROM public.users), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.user_passwords', 'id'),
  COALESCE((SELECT max(id) FROM public.user_passwords), 1),
  true
);

COMMIT;