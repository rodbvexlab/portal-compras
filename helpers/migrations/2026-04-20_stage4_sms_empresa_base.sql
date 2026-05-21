BEGIN;

-- Stage 4: infraestrutura base de notificações SMS transacionais (SMS Empresa).
-- Objetivo: manter envio desacoplado da transação principal e rastreável por log.

CREATE TABLE IF NOT EXISTS notificacoes_sms (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  tentativa_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  enviado_em TIMESTAMP WITHOUT TIME ZONE NULL,

  evento TEXT NOT NULL,
  status_envio TEXT NOT NULL,

  solicitacao_id BIGINT NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
  usuario_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,

  destinatario_numero TEXT NULL,
  mensagem TEXT NOT NULL,
  referencia TEXT NOT NULL,

  sms_empresa_id TEXT NULL,
  sms_empresa_codigo TEXT NULL,
  sms_empresa_situacao TEXT NULL,
  sms_empresa_descricao TEXT NULL,

  payload_requisicao JSONB NULL,
  payload_resposta JSONB NULL,
  erro TEXT NULL,

  CONSTRAINT notificacoes_sms_status_check
    CHECK (status_envio IN ('tentativa', 'sucesso', 'falha'))
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_sms_solicitacao_created
  ON notificacoes_sms (solicitacao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_sms_status_created
  ON notificacoes_sms (status_envio, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_sms_evento_created
  ON notificacoes_sms (evento, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_sms_sms_empresa_id
  ON notificacoes_sms (sms_empresa_id)
  WHERE sms_empresa_id IS NOT NULL;

COMMIT;
