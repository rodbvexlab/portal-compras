BEGIN;

-- Modelo hibrido de compra real:
-- - legado segue funcionando via valor_real_compra (total)
-- - novo fluxo usa valor_real_compra_unitario + quantidade
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS valor_real_compra_unitario NUMERIC(14, 2) NULL;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_valor_real_compra_unitario
  ON solicitacoes (valor_real_compra_unitario);

-- Auditoria por campo alterado em ajustes operacionais de compras.
CREATE TABLE IF NOT EXISTS solicitacoes_ajustes_operacionais (
  id SERIAL PRIMARY KEY,
  solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  campo VARCHAR(80) NOT NULL,
  valor_anterior TEXT NULL,
  valor_novo TEXT NULL,
  justificativa TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sol_ajustes_operacionais_solicitacao_data
  ON solicitacoes_ajustes_operacionais (solicitacao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sol_ajustes_operacionais_usuario_data
  ON solicitacoes_ajustes_operacionais (usuario_id, created_at DESC);

COMMIT;
