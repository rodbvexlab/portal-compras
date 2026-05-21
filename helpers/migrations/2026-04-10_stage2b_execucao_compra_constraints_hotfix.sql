BEGIN;

-- 1) Garantia idempotente dos campos operacionais da compra real.
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS valor_real_compra NUMERIC(14, 2) NULL,
  ADD COLUMN IF NOT EXISTS data_compra TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS fornecedor TEXT NULL,
  ADD COLUMN IF NOT EXISTS canal_compra TEXT NULL,
  ADD COLUMN IF NOT EXISTS referencia_pedido VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS observacao_compra TEXT NULL;

-- Índices de apoio para consultas executivas.
CREATE INDEX IF NOT EXISTS idx_solicitacoes_data_compra
  ON solicitacoes (data_compra);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_fornecedor
  ON solicitacoes (fornecedor);

-- 2) Hotfix de compatibilidade de forma_pagamento para novos métodos estruturados.
ALTER TABLE solicitacoes
  DROP CONSTRAINT IF EXISTS chk_solicitacoes_forma_pagamento;

ALTER TABLE solicitacoes
  ADD CONSTRAINT chk_solicitacoes_forma_pagamento
  CHECK (
    forma_pagamento IS NULL
    OR forma_pagamento IN (
      'pix',
      'boleto',
      'transferencia',
      'cartao',
      'outro',
      'cartao_acseg',
      'cartao_acontrans',
      'cartao_sp',
      'dinheiro'
    )
  );

-- 3) Hotfix de parcelas:
--    - obrigatório para qualquer método de cartão
--    - proibido para os demais métodos
ALTER TABLE solicitacoes
  DROP CONSTRAINT IF EXISTS chk_solicitacoes_parcelas;

ALTER TABLE solicitacoes
  ADD CONSTRAINT chk_solicitacoes_parcelas
  CHECK (
    (
      forma_pagamento IN ('cartao', 'cartao_acseg', 'cartao_acontrans', 'cartao_sp')
      AND parcelas IS NOT NULL
      AND parcelas >= 1
      AND parcelas <= 12
    )
    OR
    (
      (forma_pagamento IS NULL OR forma_pagamento NOT IN ('cartao', 'cartao_acseg', 'cartao_acontrans', 'cartao_sp'))
      AND parcelas IS NULL
    )
  );

COMMIT;
