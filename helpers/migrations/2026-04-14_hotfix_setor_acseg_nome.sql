BEGIN;

-- Hotfix: corrige typo do setor "ACESEG" para "ACSEG"
-- Idempotente: só altera quando encontrar exatamente o nome antigo.
UPDATE setores
SET
  nome = 'ACSEG',
  updated_at = NOW()
WHERE UPPER(TRIM(nome)) = 'ACESEG';

COMMIT;
