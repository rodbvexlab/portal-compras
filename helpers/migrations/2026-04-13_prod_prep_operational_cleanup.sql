BEGIN;

-- ============================================================================
-- PREPARAÇÃO DE PRODUÇÃO - LIMPEZA OPERACIONAL SEGURA
-- ----------------------------------------------------------------------------
-- Objetivo:
-- - Remover dados transacionais de homologação/teste
-- - Preservar estrutura, cadastros base (setores/categorias) e usuários definidos
-- - Resetar sequences de tabelas operacionais
--
-- IMPORTANTE:
-- 1) Execute backup completo antes de rodar.
-- 2) Revise e ajuste a lista de usuários preservados abaixo.
-- 3) Script pensado para PostgreSQL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Usuários que DEVEM ser preservados (ajuste antes de executar)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _preserve_users (
  email TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO _preserve_users (email)
VALUES
  ('rodolfo@acontrans.org'),
  ('carolina@acontrans.org'),
  ('cleberson@acontrans.org');

-- Garante que existe pelo menos 1 admin preservado no banco.
DO $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  SELECT COUNT(*)::INT
    INTO v_admin_count
  FROM users u
  INNER JOIN _preserve_users p
    ON LOWER(p.email) = LOWER(u.email)
  WHERE u.role = 'admin';

  IF v_admin_count = 0 THEN
    RAISE EXCEPTION
      'Abortado: nenhum usuário admin preservado foi encontrado. Revise _preserve_users.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Limpeza transacional (dependências: aprovacoes/historico -> solicitacoes)
-- ---------------------------------------------------------------------------
DELETE FROM aprovacoes;
DELETE FROM historico_status;
DELETE FROM solicitacoes;

-- Tabela legada opcional (se existir no ambiente)
DO $$
BEGIN
  IF to_regclass('public.solicitacao_historico') IS NOT NULL THEN
    EXECUTE 'DELETE FROM solicitacao_historico';
  END IF;
END $$;

-- Sessões e dados operacionais derivados
DELETE FROM sessions;
DELETE FROM login_attempts;

-- Tabelas OAuth opcionais (se existirem no ambiente)
DO $$
BEGIN
  IF to_regclass('public.oauth_states') IS NOT NULL THEN
    EXECUTE 'DELETE FROM oauth_states';
  END IF;

  IF to_regclass('public.oauth_accounts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM oauth_accounts';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Limpeza de usuários não preservados
--    (depois de limpar transacional para evitar bloqueio por FK)
-- ---------------------------------------------------------------------------
-- Remove referências self-FK para usuários que serão excluídos.
UPDATE users
SET created_by = NULL
WHERE created_by IN (
  SELECT u.id
  FROM users u
  WHERE LOWER(u.email) NOT IN (SELECT LOWER(email) FROM _preserve_users)
);

UPDATE users
SET updated_by = NULL
WHERE updated_by IN (
  SELECT u.id
  FROM users u
  WHERE LOWER(u.email) NOT IN (SELECT LOWER(email) FROM _preserve_users)
);

-- Remove senhas dos usuários não preservados.
DELETE FROM user_passwords up
USING users u
WHERE up.user_id = u.id
  AND LOWER(u.email) NOT IN (SELECT LOWER(email) FROM _preserve_users);

-- Remove usuários não preservados.
DELETE FROM users
WHERE LOWER(email) NOT IN (SELECT LOWER(email) FROM _preserve_users);

-- ---------------------------------------------------------------------------
-- 3) Reset de sequences para ambiente limpo
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.aprovacoes') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('aprovacoes', 'id'),
      COALESCE((SELECT MAX(id) FROM aprovacoes), 1),
      EXISTS (SELECT 1 FROM aprovacoes)
    );
  END IF;

  IF to_regclass('public.historico_status') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('historico_status', 'id'),
      COALESCE((SELECT MAX(id) FROM historico_status), 1),
      EXISTS (SELECT 1 FROM historico_status)
    );
  END IF;

  IF to_regclass('public.solicitacoes') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('solicitacoes', 'id'),
      COALESCE((SELECT MAX(id) FROM solicitacoes), 1),
      EXISTS (SELECT 1 FROM solicitacoes)
    );
  END IF;

  IF to_regclass('public.login_attempts') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('login_attempts', 'id'),
      COALESCE((SELECT MAX(id) FROM login_attempts), 1),
      EXISTS (SELECT 1 FROM login_attempts)
    );
  END IF;

  IF to_regclass('public.user_passwords') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('user_passwords', 'id'),
      COALESCE((SELECT MAX(id) FROM user_passwords), 1),
      EXISTS (SELECT 1 FROM user_passwords)
    );
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    PERFORM setval(
      pg_get_serial_sequence('users', 'id'),
      COALESCE((SELECT MAX(id) FROM users), 1),
      EXISTS (SELECT 1 FROM users)
    );
  END IF;
END $$;

COMMIT;
