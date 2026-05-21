BEGIN;

-- Guarda preventiva contra novos textos mojibake em categorias.
ALTER TABLE categorias
  DROP CONSTRAINT IF EXISTS chk_categorias_nome_sem_mojibake;

ALTER TABLE categorias
  ADD CONSTRAINT chk_categorias_nome_sem_mojibake
  CHECK (
    nome NOT LIKE '%Ã_%'
    AND nome NOT LIKE '%Â_%'
    AND nome NOT LIKE '%¢%'
    AND nome NOT LIKE '%‡%'
    AND nome NOT LIKE '%Æ%'
    AND nome NOT LIKE '%¡%'
  );

ALTER TABLE categorias
  DROP CONSTRAINT IF EXISTS chk_categorias_descricao_sem_mojibake;

ALTER TABLE categorias
  ADD CONSTRAINT chk_categorias_descricao_sem_mojibake
  CHECK (
    descricao IS NULL
    OR (
      descricao NOT LIKE '%Ã_%'
      AND descricao NOT LIKE '%Â_%'
      AND descricao NOT LIKE '%¢%'
      AND descricao NOT LIKE '%‡%'
      AND descricao NOT LIKE '%Æ%'
      AND descricao NOT LIKE '%¡%'
    )
  );

COMMIT;

