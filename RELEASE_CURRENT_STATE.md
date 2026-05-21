# RELEASE_CURRENT_STATE

## 1. Estado atual conhecido do sistema

O Portal Compras esta operando como aplicacao web interna com:

- frontend React/Vite
- backend Node/Hono servindo API e arquivos do `dist`
- autenticacao por sessao
- controle de usuarios, perfis e troca obrigatoria de senha
- fluxo de solicitacoes, aprovacoes e operacao de compra
- dashboard operacional e dashboard executivo
- notificacoes por e-mail ativas no codigo
- SMS preparado e controlado por configuracao

Contexto operacional oficial atual:

- a operacao principal do sistema esta concentrada em `admin`
- `diretora_financeiro` deve visualizar todas as solicitacoes do sistema
- `diretora_financeiro` tambem pode abrir/criar solicitacoes
- `financeiro` continua sendo somente leitura gerencial
- `ti` deve ser tratado como perfil compativel/inativo no momento
- a regra de R$ 500 nao e prioridade operacional agora

Regra oficial de aprovacao financeira que deve prevalecer na documentacao:

- toda solicitacao criada deve ir para `pendente_financeiro`
- toda solicitacao deve passar pela `diretora_financeiro`
- a `diretora_financeiro` e a aprovadora financeira principal
- nenhuma solicitacao deve ir para compra sem passar pela aprovacao financeira
- qualquer uso de `pendente_diretoria` ou de limite de R$ 500 deve ser tratado como compatibilidade ou segunda alcada futura

Validacao desta leitura:

- `npm run check:mojibake`: OK
- `npm run build`: OK

Limitacoes da leitura:

- esta pasta nao esta com `.git` disponivel, entao nao foi possivel consultar historico/commit oficial
- as ultimas alteracoes relevantes abaixo foram inferidas por timestamps de arquivos, nomes de migrations e comportamento implementado

## 2. Ultimas alteracoes relevantes

### 2.1 Ajustes recentes observados por arquivos alterados em 27/04/2026

- refinamento de autenticacao e sessao:
  - `helpers/getSetServerSession.tsx`
  - `helpers/useAuth.tsx`
  - `endpoints/auth/login_with_password_POST.ts`
- ajustes no fluxo de solicitacoes:
  - `endpoints/solicitacoes/create_POST.ts`
  - `endpoints/solicitacoes/update_POST.ts`
  - `endpoints/solicitacoes/update-status_POST.ts`
- evolucao de dashboard e navegacao:
  - `pages/_index.tsx`
  - `pages/_index.module.css`
  - `pages/_index.StatusChart.tsx`
  - `components/AppSidebarLayout.tsx`
  - `App.tsx`
- ajustes de dominio e permissoes:
  - `helpers/solicitacoesDomain.ts`
  - `helpers/accessGroups.ts`
  - `components/ProtectedRoute.tsx`

### 2.2 Migrations e compatibilizacoes recentes

- `helpers/migrations/2026-04-24_stage6_empresa_solicitacoes.sql`
- `helpers/migrations/2026-04-24_stage6b_empresa_acontrans.sql`
  - inclusao/normalizacao do campo `empresa`
  - constraint com:
    - `grupo_acontrans`
    - `acontrans`
    - `acontrans_sp`
    - `acseg`
- `helpers/migrations/2026-04-20_stage4_sms_empresa_base.sql`
- `helpers/migrations/2026-04-20_stage5_email_notifications_base.sql`
- `helpers/migrations/2026-04-17_stage3_modelo_hibrido_valor_real_e_auditoria.sql`
- `sql/2026-04-17_compat_solicitacoes_ajustes_operacionais.sql`
  - view de compatibilidade para `solicitacoes_ajustes_operacionais`

### 2.3 Funcionalidades materialmente presentes hoje

- dashboard executivo com filtros por:
  - periodo
  - setor
  - empresa
  - metodo de pagamento
  - canal de compra
- exportacao de relatorio PDF executivo
- operacao de compras TI com:
  - assumir compra
  - registrar compra
  - confirmar entrega
  - ajuste operacional
- gestao de usuarios com:
  - criar
  - editar
  - ativar/inativar
  - redefinir senha provisoria
  - excluir quando permitido

## 3. Pendencias conhecidas

- inexistencia de repositorio Git acessivel nesta pasta para rastrear release por commit
- ausencia de script formal de deploy na raiz
- existencia de arquivos e comportamentos orfaos/parcialmente paralelos:
  - `pages/aprovacoes-diretoria.tsx`
  - `pages/aprovacoes-diretoria.pageLayout.tsx`
  - hoje nao estao roteados em `App.tsx`
- regra oficial de perfis ainda nao esta totalmente consolidada no codigo:
  - existe `diretora_empresa` em producao de codigo
  - esse papel deve ser mantido como compativel/opcional
- regra oficial de status ainda nao esta totalmente consolidada no codigo:
  - existem `cancelado` e `inviavel_operacional` alem da lista oficial
- regra de R$ 500 continua presente no codigo:
  - deve ser tratada como compatibilidade ou segunda alcada futura
  - nao deve ser tratada como prioridade operacional atual

## 4. Riscos atuais

### 4.1 Risco funcional

- divergencia entre documentacao desejada e implementacao real de perfis/status pode gerar regressao se alguem padronizar sem mapear impacto em banco, UI e API
- divergencia entre a regra operacional atual e a modelagem futura de segunda alcada pode causar interpretacao incorreta do fluxo por time, suporte e futuras releases

### 4.2 Risco de seguranca

- `env.json` contem segredos operacionais carregados diretamente em runtime
- isso aumenta risco de exposicao acidental, copia indevida e erro operacional

### 4.3 Risco operacional

- deploy aparenta ser manual e dependente de procedimento humano
- sem script/manifesto de release, cresce a chance de esquecer:
  - backup
  - migration necessaria
  - rebuild
  - restart do servico
  - smoke test final

### 4.4 Risco de governanca

- sem Git local acessivel, fica mais dificil responder:
  - o que entrou na release
  - quando entrou
  - quem alterou
  - qual migration acompanha qual mudanca

## 5. Areas sensiveis

- `endpoints/solicitacoes/update-status_POST.ts`
  - concentra transicoes criticas, permissoes e notificacoes
- `helpers/solicitacoesDomain.ts`
  - concentra status, visibilidade, limiar de diretoria e regras de dominio
- `helpers/schema.tsx`
  - define enums/tipos que impactam backend e frontend
- `helpers/accessGroups.ts`
  - define grupos de navegacao/permissao
- `components/ProtectedRoute.tsx`
  - protege rotas por perfil
- `helpers/monetary.ts` e `helpers/monetarySql.ts`
  - sustentam o modelo hibrido de valores
- `helpers/solicitacaoEmailNotifications.ts`
- `helpers/solicitacaoNotifications.ts`
  - notificacoes nao podem quebrar a transacao principal
- `env.json`
  - ponto critico de credenciais e configuracao

## 6. Proximos passos recomendados

### Recomendacao principal

1. homologar esta atualizacao documental como representacao da operacao real atual
2. tratar `admin` como perfil operacional principal nesta fase
3. tratar `ti` como perfil compativel/inativo e nao como prioridade de ajuste
4. manter `diretora_financeiro` com foco em:
   - visao global
   - criacao de solicitacao
   - aprovacao financeira principal
5. deixar a regra de R$ 500 fora do foco operacional imediato

### Recomendacao tecnica futura

- revisar depois, com calma, se o comportamento de TI deve voltar a ser protagonista operacional
- decidir em momento futuro se a segunda alcada por valor continuara ativa, configuravel ou apenas compativel
- formalizar trilha de auditoria de release
- adicionar smoke test minimo de endpoints criticos apos deploy

## 7. Inconsistencias encontradas nesta leitura

### Perfis

- a documentacao oficial agora admite `admin` como perfil operacional principal
- a documentacao oficial agora admite `diretora_financeiro` com criacao de solicitacoes e visao global
- `ti` deixa de ser foco operacional principal na documentacao, mas continua presente no codigo como perfil ativo/compativel

### Aprovacao financeira

- a regra oficial continua exigindo que toda solicitacao passe primeiro por `pendente_financeiro`
- a `diretora_financeiro` continua como aprovadora principal
- a regra de R$ 500 deixa de ser prioridade operacional documental

### Segunda alcada

- `diretora_empresa` e `pendente_diretoria` permanecem como compatibilidade / segunda alcada futura
- sua existencia no codigo deixa de ser conflito principal, desde que nao substituam a aprovacao financeira

### Status

- a baseline oficial lista 9 status principais do fluxo
- o codigo atual suporta tambem:
  - `cancelado`
  - `inviavel_operacional`

### Navegacao e protecao

- a necessidade de menu para `diretora_financeiro` fica mais clara:
  - Dashboard
  - Aprovacoes Financeiras
  - Solicitacoes

## 8. Veredito documental atual

- documentacao oficial atualizada para refletir a operacao real atual
- documentacao agora prioriza:
  - `admin` como operacional principal
  - `diretora_financeiro` com visao global e criacao permitida
  - `financeiro` como leitura gerencial
  - `ti` como perfil compativel/inativo no momento
  - R$ 500 como compatibilidade / segunda alcada futura
- `DECISIONS.md` continua sendo a fonte objetiva de decisoes oficiais para futuras implementacoes
- veredito:
  - DOCUMENTACAO OK
