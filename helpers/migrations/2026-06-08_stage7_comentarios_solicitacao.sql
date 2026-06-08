CREATE TABLE IF NOT EXISTS comentarios_solicitacao (
  id BIGSERIAL PRIMARY KEY,
  solicitacao_id BIGINT NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES users(id),
  texto TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_solicitacao_solicitacao_id
  ON comentarios_solicitacao(solicitacao_id);
