# RELEASE_ajuste-administrativo-compra

## 1. Identificacao

- Nome da release: `ajuste-administrativo-compra`
- Data: `2026-05-11`
- Responsavel: Codex / Release QA
- Objetivo: validar a entrega do ajuste administrativo da compra com endpoint dedicado, auditoria campo-a-campo e UI no detalhe da solicitacao

## 2. Tipo de alteracao

- [x] UI
- [x] Permissao
- [x] Backend
- [ ] Banco
- [ ] Performance
- [ ] Notificacao
- [x] Release/QA

## 3. Arquivos para subir

```text
- endpoints/solicitacoes/admin-adjust_POST.ts
- endpoints/solicitacoes/admin-adjust_POST.schema.ts
- server.ts
- helpers/solicitacoesDomain.ts
- helpers/useSolicitacoes.tsx
- endpoints/solicitacoes/detail_GET.ts
- endpoints/solicitacoes/detail_GET.schema.ts
- pages/solicitacoes.$solicitacaoId.tsx
- pages/solicitacoes.$solicitacaoId.module.css
```

## 4. Arquivos novos

```text
- endpoints/solicitacoes/admin-adjust_POST.ts
- endpoints/solicitacoes/admin-adjust_POST.schema.ts
```

## 5. Arquivos para remover

```text
- nenhum
```

## 6. SQL/migrations

- Ha SQL/migration? `nao`
- Arquivos:

```text
- nenhum
```

- Ordem de execucao: `NA`
- Janela de aplicacao: `NA`
- Observacoes: a implementacao reutiliza `solicitacoesAjustesOperacionais` ja existente

## 7. Variaveis de ambiente

- Ha alteracao de ambiente? `nao`
- Arquivos/variaveis impactadas:

```text
- nenhuma
```

- Requer restart adicional? `nao`
- Observacoes: somente restart normal do servico apos publicacao

## 8. Testes executados

```text
- npm run build
- npm run check:mojibake
- validacao backend com massa temporaria em:
  - aprovado_para_compra
  - em_compra
  - comprado
  - concluido
  - devolvido
- validacao de auditoria campo-a-campo
- validacao 403 para perfis nao-admin
- validacao 400 para justificativa vazia
- validacao 400 para nenhum campo alterado
- validacao de campos proibidos sem impacto em status/financeiro/solicitante
- validacao de listagem, stats e PDF refletindo dados corrigidos
- validacao visual automatizada via Playwright headless no detalhe da solicitacao
- revalidacao apos correcao do runtime na tela de detalhe
- smoke visual em build de producao nos status:
  - aprovado_para_compra
  - em_compra
  - comprado
  - concluido
  - devolvido
- ajuste visual como admin em em_compra com alteracao de:
  - empresa
  - setor
  - categoria
  - metodo de pagamento
  - canal/plataforma
  - valor real unitario
  - quantidade
```

## 9. Perfis testados

- [x] admin
- [x] diretora_financeiro
- [x] financeiro
- [ ] ti
- [x] lider_setor
- [x] user
- [ ] diretora_empresa

Observacoes:

- `ti` e `diretora_empresa` nao fazem parte do escopo funcional desta entrega
- `admin`, `diretora_financeiro`, `financeiro`, `lider_setor` e `user` foram cobertos no backend

## 10. Resultado do build

- Comando: `npm run build`
- Resultado: `OK`
- Evidencia: build concluido sem erro em `2026-05-11`

## 11. Resultado do check:mojibake

- Executado? `sim`
- Resultado: `OK`
- Evidencia: `OK: nenhum mojibake detectado nos arquivos de runtime`

## 12. Riscos

```text
- risco baixo: a validacao visual foi automatizada em headless e ficou com boa cobertura, mas continua valendo uma passada humana curta apos o deploy
- risco baixo: o teste visual alterou `data_compra` por normalizacao de input date no navegador, embora isso nao altere a regra de negocio nem a seguranca da entrega
- risco operacional baixo: a release depende de publicacao coordenada de frontend e backend da mesma entrega
```

## 13. Plano de rollback

- Backup do banco: conforme `DEPLOY_CHECKLIST.md`
- Backup da pasta app: conforme `DEPLOY_CHECKLIST.md`
- Procedimento resumido:

```text
1. parar servico
2. restaurar arquivos da release anterior
3. rebuild
4. restart
5. validar logs
```

## 14. Gate de release

- Orchestrator revisou? `sim`
- Especialista correto revisou? `sim`
- Release QA revisou? `sim`
- Pacote de producao controlado? `sim`

## 15. Veredito

- [x] GO
- [ ] GO com ressalvas
- [ ] NAO GO

Motivo do veredito:

- a causa do bloqueio anterior era real e foi corrigida:
  - uso de valor derivado dentro de `useMemo` antes da inicializacao da constante no render
  - erro anterior reproduzido: `ReferenceError: Cannot access 'V' before initialization`
- revalidacao completa:
  - build OK
  - check:mojibake OK
  - tela de detalhe abriu sem runtime error em build de producao
  - secao `Ajuste administrativo` visivel para admin nos 5 status elegiveis
  - perfil nao-admin nao visualizou nem acionou a secao editavel
  - endpoint `/_api/solicitacoes/admin-adjust` permaneceu consistente
  - auditoria campo-a-campo confirmada
  - status preservado
  - dashboard/stats/PDF refletindo os valores corrigidos
- evidencias:
  - `qa-artifacts/admin-adjust-release-qa/summary.json`
  - screenshots em `qa-artifacts/admin-adjust-release-qa/`

## 16. Aprovacoes finais

- Responsavel tecnico: pendente
- Responsavel deploy: pendente
- Responsavel QA: Codex / Release QA
- Observacoes finais:
  - backend e UI homologados nesta rodada
  - sem SQL/migration
  - pacote apto para producao
