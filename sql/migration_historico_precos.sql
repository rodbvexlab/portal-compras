CREATE TABLE IF NOT EXISTS historico_precos (
  id SERIAL PRIMARY KEY,
  titulo_normalizado TEXT NOT NULL,
  titulo_original TEXT NOT NULL,
  valor_unitario NUMERIC(12,2) NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  quantidade INTEGER NOT NULL,
  fornecedor TEXT,
  canal TEXT,
  data_compra TIMESTAMPTZ NOT NULL,
  solicitacao_id INTEGER REFERENCES solicitacoes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_precos_titulo
  ON historico_precos(titulo_normalizado);
