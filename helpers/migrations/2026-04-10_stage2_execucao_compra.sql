BEGIN;

ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS valor_real_compra NUMERIC(14, 2) NULL,
  ADD COLUMN IF NOT EXISTS data_compra TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS fornecedor TEXT NULL,
  ADD COLUMN IF NOT EXISTS canal_compra TEXT NULL,
  ADD COLUMN IF NOT EXISTS referencia_pedido VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS observacao_compra TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_data_compra
  ON solicitacoes (data_compra);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_fornecedor
  ON solicitacoes (fornecedor);

COMMIT;

