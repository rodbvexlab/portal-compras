# PROJECT_CONTEXT

## 1. Objetivo do sistema

Portal Interno de Requisicao de Compras para:

- registrar solicitacoes internas de compra
- controlar aprovacao financeira
- controlar fluxo de compras pelo operacional atual
- gerar rastreabilidade, respaldo e visao financeira por setor/empresa

Escopo atual observado no codigo:

- frontend web com areas separadas por perfil
- backend HTTP interno com autenticacao por sessao
- persistencia de historico de status, aprovacoes e notificacoes
- dashboard operacional e dashboard executivo no mesmo produto

## 2. Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + TypeScript
- Banco: PostgreSQL
- ORM/query builder: Kysely + postgres
- Estilo: CSS Modules
- Servico Windows: previsto para rodar como servico via NSSM
- Producao alvo: `C:\Sistemas\PortalCompras\app`
- Porta observada no backend atual: `3333`

Arquivos centrais:

- frontend: `App.tsx`
- backend HTTP: `server.ts`
- variaveis locais carregadas de arquivo: `loadEnv.js` + `env.json`

## 3. Perfis e permissoes

### Baseline oficial

#### admin

- acesso total
- administra usuarios
- opera Compras TI
- visualiza tudo
- pode criar solicitacao
- pode ajustar e excluir conforme a regra atual

#### diretora_financeiro

- acessa Dashboard
- acessa Aprovacoes Financeiras
- acessa Solicitacoes globais
- visualiza todas as solicitacoes do sistema
- pode criar solicitacao
- pode aprovar, reprovar ou devolver qualquer solicitacao no fluxo financeiro, independentemente do valor
- e a aprovadora financeira principal do sistema
- nao acessa Compras TI
- nao administra usuarios
- menu desejado:
  - Dashboard
  - Aprovacoes Financeiras
  - Solicitacoes

#### financeiro

- acessa Dashboard executivo igual a diretora_financeiro
- acessa Solicitacoes globais
- e somente leitura
- nao cria solicitacao
- nao aprova
- nao altera status
- nao exclui
- nao acessa Aprovacoes Financeiras
- nao acessa Compras TI
- nao acessa Usuarios

#### ti

- manter documentado como perfil compativel/inativo no momento
- nao usar como foco operacional principal nesta fase
- nao priorizar correcoes de TI nesta fase, salvo risco critico

#### lider_setor

- Nova Solicitacao
- Minhas Solicitacoes
- visualiza apenas suas solicitacoes / escopo permitido
- nao aprova
- nao compra

#### user

- cria e acompanha suas solicitacoes
- nao acessa areas globais

#### diretora_empresa

- papel opcional e compativel de aprovacao superior / segunda alcada
- atua apenas apos a aprovacao financeira, quando a politica de segunda alcada estiver ativa
- nao substitui a diretora_financeiro

### Estado implementado hoje que precisa ser conhecido

- o codigo reconhece o perfil `diretora_empresa`
- grupos de acesso atuais em `helpers/accessGroups.ts`:
  - `lider`: `lider_setor`, `user`
  - `diretoria`: `diretora_financeiro`, `diretora_empresa`
  - `financeiro`: `financeiro`
  - `tecnologia`: `ti`, `admin`
- rota `/aprovacoes` hoje atende:
  - `diretora_financeiro` para `pendente_financeiro`
  - `diretora_empresa` para `pendente_diretoria`
  - `admin` cobre ambos os cenarios
- a operacao principal atual esta concentrada em `admin`

## 4. Status oficiais do fluxo

- `rascunho`
- `pendente_financeiro`
- `pendente_diretoria`
- `aprovado_para_compra`
- `em_compra`
- `comprado`
- `concluido`
- `devolvido`
- `rejeitado`

### Fluxo oficial de status

1. toda solicitacao criada deve entrar em `pendente_financeiro`
2. a `diretora_financeiro` deve sempre analisar antes de qualquer avanco operacional para compra
3. apos aprovacao financeira:
   - a solicitacao pode seguir para `aprovado_para_compra`; ou
   - se a segunda alcada estiver ativa no futuro, pode seguir para `pendente_diretoria`
4. `pendente_diretoria` representa aprovacao superior opcional e compativel
5. nenhuma solicitacao deve seguir para compra sem passar por `pendente_financeiro`

### Observacao importante do estado atual

Além dos status oficiais acima, o schema e o backend hoje tambem aceitam:

- `cancelado`
- `inviavel_operacional`

Esses dois status existem em:

- `helpers/schema.tsx`
- `helpers/solicitacoesDomain.ts`
- `endpoints/solicitacoes/update-status_POST.ts`

Portanto, qualquer ajuste futuro de padronizacao precisa considerar compatibilidade com dados e transicoes ja implementadas.

## 5. Regras financeiras

- valor total estimado = valor unitario estimado x quantidade
- valor real novo = `valor_real_compra_unitario x quantidade`
- registros legados podem usar `valor_real_compra` como total
- nunca quebrar o modelo hibrido de valores

Regra oficial de aprovacao financeira:

- toda solicitacao criada deve ir para `pendente_financeiro`
- toda solicitacao deve ser analisada pela `diretora_financeiro`
- a `diretora_financeiro` pode aprovar, reprovar ou devolver qualquer solicitacao, independentemente do valor
- nenhuma solicitacao pode ir para compra sem passar pela aprovacao financeira
- a regra de R$ 500 nao e prioridade operacional no momento
- se existir no codigo, o limite deve ser tratado apenas como compatibilidade ou segunda alcada futura

Base tecnica atual:

- calculo estimado centralizado em `helpers/monetary.ts`
- SQL hibrido centralizado em `helpers/monetarySql.ts`
- backend ja trata compatibilidade entre:
  - `valorRealCompraUnitario`
  - `valorRealCompra`

Observacao sobre a regra de R$ 500:

- o valor acima de `500` nao substitui a aprovacao financeira
- esse limite nao e foco operacional atual
- se a regra continuar existindo no codigo, deve ser tratada apenas como compatibilidade ou segunda alcada futura

## 6. Empresas validas

- `grupo_acontrans` = Grupo Acontrans
- `acontrans` = Acontrans
- `acontrans_sp` = Acontrans SP
- `acseg` = ACSEG

Base tecnica atual:

- definidas no schema tipado
- usadas no frontend em `helpers/solicitacoesDomain.ts`
- reforcadas por migration/constraint de banco

## 7. Regras de notificacao

- e-mail ja implementado
- SMS preparado/desabilitado conforme env
- notificacoes nao podem quebrar a transacao principal
- envio deve ser assincrono/resiliente quando aplicavel

Estado atual observado:

- e-mail:
  - criacao de solicitacao
  - mudancas de status relevantes
  - logs em `notificacoesEmail`
- SMS:
  - hoje focado em evento de devolucao
  - logs em `notificacoesSms`
- disparos executados apos persistencia principal com `setImmediate(...)`
- falha de notificacao e registrada em log e nao deve desfazer a operacao principal

## 8. Regras de deploy

- sempre fazer backup antes
- copiar arquivos controlados por release
- aplicar migration somente quando necessario
- rodar `npm run build` no servidor
- reiniciar servico `PortalCompras`
- validar logs e smoke test

Estado operacional observado:

- nao ha script formal de deploy na raiz do projeto
- o backend serve `dist` localmente via `server.ts`
- `env.json` e carregado em runtime por `loadEnv.js`
- build atual validado localmente nesta leitura com sucesso

## 9. Definition of Done

- build passou
- `check:mojibake` passou, se existir
- perfis afetados testados
- endpoints criticos testados
- UI validada
- lista final de arquivos entregue
- SQL/migration declarado
- veredito GO/NAO GO

## Estrutura funcional resumida

- login e sessao
- dashboard
- aprovacoes
- solicitacoes globais
- minhas solicitacoes
- detalhe da solicitacao
- operacao de compras TI
- administracao de usuarios
- troca obrigatoria de senha

## Endpoints principais observados

- auth:
  - `/_api/auth/login_with_password`
  - `/_api/auth/logout`
  - `/_api/auth/session`
  - `/_api/auth/change_password`
  - `/_api/auth/admin_reset_password`
- cadastros:
  - `/_api/setores/list`
  - `/_api/categorias/list`
  - `/_api/users/list`
  - `/_api/users/create`
  - `/_api/users/update`
  - `/_api/users/delete`
- solicitacoes:
  - `/_api/solicitacoes/list`
  - `/_api/solicitacoes/detail`
  - `/_api/solicitacoes/stats`
  - `/_api/solicitacoes/create`
  - `/_api/solicitacoes/update`
  - `/_api/solicitacoes/update-status`
  - `/_api/solicitacoes/delete`
- relatorio:
  - `/_api/relatorios/executivo-pdf`

## Observacoes de governanca

- este arquivo define a base oficial enxuta para futuras implementacoes
- `DECISIONS.md` e a fonte oficial das decisoes funcionais e operacionais do Portal Compras
- qualquer mudanca futura em perfil, status, calculo financeiro ou deploy deve atualizar este arquivo junto da release
- quando houver divergencia entre este contexto e o codigo, registrar primeiro em `RELEASE_CURRENT_STATE.md`
