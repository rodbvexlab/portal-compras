# DECISIONS

Documento de decisoes oficiais do Portal Compras.

Uso:

- registrar decisoes curtas, objetivas e versionaveis
- evitar interpretacoes erradas em futuras implementacoes
- servir como fonte oficial de regra funcional e operacional

## D-001 - Aprovacao financeira obrigatoria

- Toda solicitacao criada deve entrar em `pendente_financeiro`.
- Toda solicitacao deve ser analisada pela `diretora_financeiro`, independentemente do valor.
- Nenhuma solicitacao pode seguir para compra sem aprovacao financeira.

## D-002 - Admin

- `admin` tem acesso total.
- Administra usuarios.
- Opera Compras TI.
- Visualiza tudo.
- Pode criar solicitacao.
- Pode ajustar e excluir conforme a regra atual implementada.

## D-003 - Diretoria Financeira

- `diretora_financeiro` e a aprovadora financeira principal.
- Acessa Dashboard.
- Acessa Aprovacoes Financeiras.
- Acessa Solicitacoes globais.
- Deve visualizar todas as solicitacoes do sistema.
- Pode criar solicitacao.
- Pode aprovar, reprovar ou devolver qualquer solicitacao no fluxo financeiro.
- Nao acessa Compras TI.
- Nao administra usuarios.

## D-004 - Perfil financeiro

- `financeiro` tem Dashboard executivo igual a `diretora_financeiro`.
- `financeiro` visualiza solicitacoes globais.
- `financeiro` e somente leitura.
- Nao cria, nao aprova, nao altera status, nao exclui, nao acessa Compras TI, nao acessa Aprovacoes Financeiras e nao acessa Usuarios.

## D-005 - Perfil TI

- `ti` deve ser mantido documentado como perfil compativel/inativo no momento.
- `ti` nao deve ser tratado como foco operacional principal nesta fase.
- Nao priorizar correcoes relacionadas a TI nesta fase, salvo risco critico.
- Continua sendo um perfil compativel para o fluxo operacional de compra, caso necessario no futuro.

## D-006 - Segunda alcada

- `pendente_diretoria` representa segunda alcada opcional.
- `diretora_empresa` representa papel compativel/opcional de aprovacao superior.
- A segunda alcada, quando ativa, so ocorre depois da aprovacao financeira.
- O limite de R$ 500, se usado, e apenas criterio de segunda alcada, nunca substituto da aprovacao financeira.
- A regra de R$ 500 nao e prioridade operacional no momento.

## D-007 - Menu desejado para Diretoria Financeira

- Dashboard
- Aprovacoes Financeiras
- Solicitacoes

## D-008 - Solicitacoes para Diretoria Financeira

- Na tela `Solicitacoes`, a `diretora_financeiro` pode ter acesso ao botao/acao de criar nova solicitacao.
- Esse acesso de criacao nao remove a visibilidade global de solicitacoes.

## D-009 - Status principais

- `rascunho`
- `pendente_financeiro`
- `pendente_diretoria`
- `aprovado_para_compra`
- `em_compra`
- `comprado`
- `concluido`
- `devolvido`
- `rejeitado`

## D-010 - Status compativeis

- `cancelado`
- `inviavel_operacional`
- Devem ser mantidos por compatibilidade enquanto existirem no codigo/banco.
- Nao remover sem analise especifica.

## D-011 - Empresas validas

- `grupo_acontrans`
- `acontrans`
- `acontrans_sp`
- `acseg`

## D-012 - Modelo financeiro

- Total estimado = valor unitario estimado x quantidade.
- Total real novo = `valor_real_compra_unitario x quantidade`.
- Registros legados podem usar `valor_real_compra` como total.
- Nunca quebrar o modelo hibrido de valores.

## D-013 - Release e qualidade

- Toda alteracao deve passar por:
  - Orchestrator
  - especialista correto
  - Release QA
  - pacote de producao controlado
- Nao dar GO apenas por HTTP 200.
- Validar UI, permissoes, backend, build e arquivos finais.
