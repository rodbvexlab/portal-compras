-- 1) Conferir se todos os e-mails do snapshot existem após o merge
SELECT s.email_norm
FROM mig_identity_preserve.snapshot_users s
LEFT JOIN public.users u
  ON lower(trim(u.email)) = s.email_norm
WHERE u.id IS NULL;

-- 2) Conferir se todos os usuários preservados têm senha
SELECT sp.email_norm
FROM mig_identity_preserve.snapshot_user_passwords sp
LEFT JOIN public.users u
  ON lower(trim(u.email)) = sp.email_norm
LEFT JOIN public.user_passwords up
  ON up.user_id = u.id
WHERE u.id IS NULL
   OR up.user_id IS NULL;

-- 3) Quantidade total
SELECT count(*) AS total_users FROM public.users;
SELECT count(*) AS total_passwords FROM public.user_passwords;

-- 4) Conferir usuários preservados
SELECT
  u.id,
  u.display_name,
  u.email,
  u.role,
  u.is_active,
  u.must_change_password
FROM public.users u
WHERE lower(trim(u.email)) IN (
  SELECT email_norm
  FROM mig_identity_preserve.snapshot_users
)
ORDER BY u.email;