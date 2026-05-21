BEGIN;

-- Stage 5: infraestrutura base de notificacoes de e-mail transacional.
-- Objetivo: registrar tentativa, sucesso e falha sem acoplar envio ao fluxo principal.

CREATE TABLE IF NOT EXISTS notificacoes_email (
  id BIGSERIAL PRIMARY KEY,
  solicitacao_id BIGINT NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  destinatario TEXT NULL,
  assunto TEXT NOT NULL,
  status_envio TEXT NOT NULL,
  mensagem_erro TEXT NULL,
  payload_resumo JSONB NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP WITHOUT TIME ZONE NULL,
  CONSTRAINT notificacoes_email_status_check
    CHECK (status_envio IN ('tentativa', 'sucesso', 'falha'))
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_email_solicitacao_created
  ON notificacoes_email (solicitacao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_email_status_created
  ON notificacoes_email (status_envio, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_email_evento_created
  ON notificacoes_email (evento, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_email_destinatario_created
  ON notificacoes_email (destinatario, created_at DESC)
  WHERE destinatario IS NOT NULL;

COMMIT;
