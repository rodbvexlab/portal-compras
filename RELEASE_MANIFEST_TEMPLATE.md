# RELEASE_MANIFEST_TEMPLATE

Modelo preenchivel para controle de release do Portal Compras.

## 1. Identificacao

- Nome da release:
- Data:
- Responsavel:
- Objetivo:

## 2. Tipo de alteracao

Marcar o que se aplica:

- [ ] UI
- [ ] Permissao
- [ ] Backend
- [ ] Banco
- [ ] Performance
- [ ] Notificacao
- [ ] Release/QA

## 3. Arquivos para subir

Listar arquivos alterados que devem ir para producao:

```text
- caminho/arquivo-1
- caminho/arquivo-2
- caminho/arquivo-3
```

## 4. Arquivos novos

Listar arquivos novos que precisam ser criados/publicados:

```text
- caminho/arquivo-novo-1
- caminho/arquivo-novo-2
```

## 5. Arquivos para remover

Listar arquivos obsoletos que devem ser removidos da producao:

```text
- caminho/arquivo-obsoleto-1
- caminho/arquivo-obsoleto-2
```

## 6. SQL/migrations

- Ha SQL/migration? `sim/nao`
- Arquivos:

```text
- sql/arquivo-1.sql
- helpers/migrations/arquivo-2.sql
```

- Ordem de execucao:
- Janela de aplicacao:
- Observacoes:

## 7. Variaveis de ambiente

- Ha alteracao de ambiente? `sim/nao`
- Arquivos/variaveis impactadas:

```text
- APP_BASE_URL
- SMTP_ENABLED
- SMS_EMPRESA_ENABLED
```

- Requer restart adicional? `sim/nao`
- Observacoes:

## 8. Testes executados

```text
- npm run build
- npm run check:mojibake
- smoke test funcional
- validacao de perfil
```

## 9. Perfis testados

Marcar o que foi testado nesta release:

- [ ] admin
- [ ] diretora_financeiro
- [ ] financeiro
- [ ] ti
- [ ] lider_setor
- [ ] user
- [ ] diretora_empresa

Observacoes:

## 10. Resultado do build

- Comando:
- Resultado: `OK` / `FALHOU`
- Evidencia:

## 11. Resultado do check:mojibake

- Executado? `sim/nao`
- Resultado: `OK` / `FALHOU` / `NA`
- Evidencia:

## 12. Riscos

```text
- risco 1
- risco 2
- risco 3
```

## 13. Plano de rollback

- Backup do banco:
- Backup da pasta app:
- Procedimento resumido:

```text
1. parar servico
2. restaurar arquivos
3. restaurar banco, se necessario
4. rebuild
5. restart
6. validar logs
```

## 14. Gate de release

- Orchestrator revisou? `sim/nao`
- Especialista correto revisou? `sim/nao`
- Release QA revisou? `sim/nao`
- Pacote de producao controlado? `sim/nao`

## 15. Veredito

- [ ] GO
- [ ] GO com ressalvas
- [ ] NAO GO

Motivo do veredito:

## 16. Aprovacoes finais

- Responsavel tecnico:
- Responsavel deploy:
- Responsavel QA:
- Observacoes finais:
