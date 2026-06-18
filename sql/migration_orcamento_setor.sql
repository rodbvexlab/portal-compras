CREATE TABLE IF NOT EXISTS orcamento_setor (
  id SERIAL PRIMARY KEY,
  setor TEXT NOT NULL,
  limite_mensal NUMERIC(12,2) NOT NULL,
  mes_referencia INTEGER NOT NULL,
  ano_referencia INTEGER NOT NULL,
  criado_por_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(setor, mes_referencia, ano_referencia)
);
