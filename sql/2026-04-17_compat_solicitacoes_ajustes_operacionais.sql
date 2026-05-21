-- Compatibilidade com código Node/Kysely atual (nome plural esperado)
-- Ambiente alvo: homologação (portal_compras)
-- Objetivo: expor visão atualizável com nome e colunas esperadas pelo backend.

create or replace view public.solicitacoes_ajustes_operacionais as
select
  id,
  solicitacao_id,
  campo_alterado as campo,
  valor_anterior,
  valor_novo,
  justificativa,
  usuario_id,
  created_at
from public.solicitacao_ajustes_operacionais;
