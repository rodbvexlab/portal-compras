# DEPLOY_CHECKLIST

Checklist operacional de deploy do Portal Compras.

Objetivo:

- evitar esquecimento de arquivos, migrations, build, restart e smoke test
- padronizar o deploy em ambiente Windows com servico `PortalCompras`
- reduzir risco de publicacao parcial ou GO indevido

## 1. Pre-deploy

- [ ] confirmar escopo da alteracao
- [ ] confirmar arquivos alterados
- [ ] confirmar se ha SQL/migration
- [ ] confirmar se ha arquivos a remover
- [ ] confirmar se build passou em homologacao
- [ ] confirmar se Release QA deu GO

Campos de controle:

- Release:
- Responsavel:
- Data prevista:
- Escopo validado por:
- Ha migration? `sim/nao`
- Ha arquivos para remover? `sim/nao`

## 2. Backup

### 2.1 Banco PostgreSQL

- [ ] executar backup do banco com `pg_dump`
- [ ] validar se o arquivo foi gerado com sucesso
- [ ] registrar caminho final do backup

Exemplo de comando:

```powershell
pg_dump -h localhost -p 5432 -U postgres -d portal_compras -F c -b -v -f "C:\Backups\PortalCompras\portal_compras_YYYYMMDD_HHMM.backup"
```

### 2.2 Pasta de aplicacao

- [ ] executar backup da pasta `C:\Sistemas\PortalCompras\app`
- [ ] validar se a copia foi concluida
- [ ] registrar caminho final do backup

Exemplo de comando:

```powershell
robocopy "C:\Sistemas\PortalCompras\app" "C:\Backups\PortalCompras\app_YYYYMMDD_HHMM" /MIR /R:2 /W:2
```

### 2.3 Registro do backup

- [ ] registrar data/hora do backup
- [ ] registrar responsavel
- [ ] registrar nome dos arquivos/pastas gerados

Registro:

- Backup banco:
- Backup app:
- Data/hora:
- Responsavel:

## 3. Publicacao

- [ ] copiar arquivos do release para producao
- [ ] remover arquivos obsoletos, se houver
- [ ] aplicar migration somente se necessario
- [ ] rodar `npm run build` no servidor
- [ ] reiniciar servico `PortalCompras`

### 3.1 Copia de arquivos

- [ ] validar lista de arquivos para subir
- [ ] validar lista de arquivos novos
- [ ] validar lista de arquivos para remover

### 3.2 Migration

- [ ] confirmar se existe SQL/migration nesta release
- [ ] aplicar somente o que estiver no manifest da release
- [ ] registrar horario de execucao
- [ ] registrar resultado

### 3.3 Build no servidor

Comando:

```powershell
npm run build
```

- [ ] build executado no servidor
- [ ] build finalizado sem erro

### 3.4 Restart do servico

Comandos sugeridos:

```powershell
Restart-Service PortalCompras
```

Se necessario:

```powershell
Stop-Service PortalCompras
Start-Service PortalCompras
```

- [ ] restart executado
- [ ] servico voltou para estado `Running`

## 4. Validacao tecnica

- [ ] validar `Get-Service PortalCompras`
- [ ] validar porta `3333`
- [ ] validar `portal-compras-out.log`
- [ ] validar `portal-compras-err.log`

Comandos sugeridos:

```powershell
Get-Service PortalCompras
```

```powershell
netstat -ano | findstr :3333
```

```powershell
Get-Content "C:\Sistemas\PortalCompras\portal-compras-out.log" -Tail 100
```

```powershell
Get-Content "C:\Sistemas\PortalCompras\portal-compras-err.log" -Tail 100
```

Validacoes esperadas:

- servico `Running`
- porta `3333` em escuta
- sem erro critico novo no log de erro
- sem loop de restart

## 5. Smoke test funcional

- [ ] login `admin`
- [ ] login `diretora_financeiro`
- [ ] login `financeiro`, se afetado
- [ ] login `ti`, se afetado
- [ ] criar solicitacao, se fluxo afetado
- [ ] aprovar solicitacao, se fluxo afetado
- [ ] Compras TI, se fluxo afetado
- [ ] Dashboard, se afetado
- [ ] PDF executivo, se afetado

### 5.1 Validacao por perfil

#### admin

- [ ] acessa dashboard
- [ ] acessa solicitacoes
- [ ] acessa aprovacoes
- [ ] acessa compras TI
- [ ] acessa usuarios

#### diretora_financeiro

- [ ] acessa dashboard
- [ ] acessa aprovacoes financeiras
- [ ] visualiza solicitacoes globais
- [ ] nao acessa compras TI
- [ ] nao acessa usuarios

#### financeiro

- [ ] acessa dashboard executivo
- [ ] visualiza solicitacoes globais
- [ ] nao cria solicitacao
- [ ] nao aprova
- [ ] nao altera status

#### ti

- [ ] acessa dashboard operacional, se afetado
- [ ] acessa solicitacoes
- [ ] acessa compras TI
- [ ] nao aprova financeiramente

### 5.2 Regra de GO

- [ ] nao considerar GO apenas por HTTP 200
- [ ] validar UI
- [ ] validar permissoes
- [ ] validar backend
- [ ] validar build
- [ ] validar arquivos finais publicados

## 6. Rollback

- [ ] parar servico
- [ ] restaurar pasta `app` do backup
- [ ] restaurar banco se houver migration problematica
- [ ] rebuild
- [ ] restart
- [ ] validar logs

### 6.1 Sequencia sugerida

```powershell
Stop-Service PortalCompras
```

```powershell
robocopy "C:\Backups\PortalCompras\app_YYYYMMDD_HHMM" "C:\Sistemas\PortalCompras\app" /MIR /R:2 /W:2
```

Se houver restauracao de banco, usar o backup correspondente aprovado para rollback.

```powershell
npm run build
```

```powershell
Start-Service PortalCompras
```

```powershell
Get-Service PortalCompras
```

```powershell
Get-Content "C:\Sistemas\PortalCompras\portal-compras-err.log" -Tail 100
```

## 7. Fechamento da release

- [ ] registrar resultado final
- [ ] anexar manifest da release
- [ ] anexar horario de deploy
- [ ] anexar horario de rollback, se houve
- [ ] registrar veredito final

Resultado final:

- Veredito: `GO` / `GO com ressalvas` / `NAO GO`
- Responsavel pelo deploy:
- Responsavel pela validacao:
- Inicio:
- Fim:
- Observacoes finais:
