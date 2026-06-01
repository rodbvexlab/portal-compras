$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupDir = "C:\Backups\PortalCompras"
$DeployLogPath = Join-Path $BackupDir "deploy_log.txt"
$EnvJsonPath = Join-Path $AppDir "env.json"
$NssmPath = "C:\Tools\nssm-2.24-103-gdee49fc\win64\nssm.exe"
$NodeExePath = "C:\Program Files\nodejs\node.exe"
$ServiceName = "PortalCompras"
$SmokeTestUrl = "http://localhost:3333/_api/auth/session"

$CompletedSteps = New-Object System.Collections.Generic.List[string]
$SmokeTestStatus = "Nao executado"
$BackupFilePath = $null

function Write-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  Write-Host ""
  Write-Host $Message
}

function Fail-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StepName,

    [Parameter(Mandatory = $true)]
    [System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  $message = "Falha na etapa '$StepName': $($ErrorRecord.Exception.Message)"
  Write-Host $message -ForegroundColor Red
  throw $message
}

function Invoke-ExternalCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage Codigo de saida: $LASTEXITCODE."
  }
}

function Get-DatabaseConfig {
  if (-not (Test-Path $EnvJsonPath)) {
    throw "Arquivo env.json nao encontrado em $EnvJsonPath."
  }

  $envConfig = Get-Content -Path $EnvJsonPath -Raw | ConvertFrom-Json
  $databaseUrl = $envConfig.DATABASE_URL

  if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw "DATABASE_URL nao encontrada no env.json."
  }

  $uri = [Uri]$databaseUrl
  $userInfoSeparatorIndex = $uri.UserInfo.IndexOf(":")

  if ($userInfoSeparatorIndex -lt 1) {
    throw "DATABASE_URL invalida: usuario ou senha ausente."
  }

  $databaseUser = $uri.UserInfo.Substring(0, $userInfoSeparatorIndex)
  $databasePassword = $uri.UserInfo.Substring($userInfoSeparatorIndex + 1)
  $databaseName = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))

  if ([string]::IsNullOrWhiteSpace($databaseName)) {
    throw "DATABASE_URL invalida: nome do banco ausente."
  }

  $port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }

  return [PSCustomObject]@{
    Host = $uri.Host
    Port = $port
    User = [Uri]::UnescapeDataString($databaseUser)
    Password = [Uri]::UnescapeDataString($databasePassword)
    Database = $databaseName
  }
}

function Get-PgDumpPath {
  $command = Get-Command "pg_dump.exe" -ErrorAction SilentlyContinue

  if (-not $command) {
    $command = Get-Command "pg_dump" -ErrorAction SilentlyContinue
  }

  if (-not $command) {
    $postgresBins = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Filter "pg_dump.exe" -Recurse -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending

    if ($postgresBins) {
      return $postgresBins[0].FullName
    }

    throw "pg_dump nao encontrado no PATH nem em C:\Program Files\PostgreSQL. Instale o PostgreSQL Client ou adicione o diretorio bin do PostgreSQL ao PATH."
  }

  return $command.Source
}

try {
  if (Test-Path $NodeExePath) {
    $nodeDir = Split-Path -Parent $NodeExePath
    $env:PATH = "$nodeDir;$env:PATH"
  }

  Write-Step "[1/8] Fazendo backup do banco..."
  try {
    New-Item -Path $BackupDir -ItemType Directory -Force | Out-Null

    $databaseConfig = Get-DatabaseConfig
    $pgDumpPath = Get-PgDumpPath
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $BackupFilePath = Join-Path $BackupDir "backup_$timestamp.sql"

    $env:PGPASSWORD = $databaseConfig.Password

    try {
      Invoke-ExternalCommand `
        -Command $pgDumpPath `
        -Arguments @(
          "-h", $databaseConfig.Host,
          "-p", [string]$databaseConfig.Port,
          "-U", $databaseConfig.User,
          "-d", $databaseConfig.Database,
          "-f", $BackupFilePath
        ) `
        -FailureMessage "pg_dump falhou."
    } finally {
      Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }

    if (-not (Test-Path $BackupFilePath)) {
      throw "Backup nao foi gerado em $BackupFilePath."
    }

    $CompletedSteps.Add("Backup do banco: OK ($BackupFilePath)") | Out-Null
  } catch {
    Fail-Step -StepName "Backup do banco" -ErrorRecord $_
  }

  Write-Step "[2/8] Executando git pull origin main..."
  try {
    Push-Location $AppDir
    try {
      Invoke-ExternalCommand `
        -Command "git" `
        -Arguments @("pull", "origin", "main") `
        -FailureMessage "git pull origin main falhou."
    } finally {
      Pop-Location
    }

    $CompletedSteps.Add("Git pull: OK") | Out-Null
  } catch {
    Fail-Step -StepName "Git pull" -ErrorRecord $_
  }

  Write-Step "[3/8] Instalando dependencias com npm ci --legacy-peer-deps..."
  try {
    Push-Location $AppDir
    try {
      Invoke-ExternalCommand `
        -Command "npm" `
        -Arguments @("ci", "--legacy-peer-deps") `
        -FailureMessage "npm ci --legacy-peer-deps falhou."
    } finally {
      Pop-Location
    }

    $CompletedSteps.Add("Install de dependencias: OK") | Out-Null
  } catch {
    Fail-Step -StepName "Install de dependencias" -ErrorRecord $_
  }

  Write-Step "[4/8] Executando build..."
  try {
    Push-Location $AppDir
    try {
      Invoke-ExternalCommand `
        -Command "npm" `
        -Arguments @("run", "build") `
        -FailureMessage "npm run build falhou. Servico nao sera reiniciado com build quebrado."
    } finally {
      Pop-Location
    }

    $CompletedSteps.Add("Build: OK") | Out-Null
  } catch {
    Fail-Step -StepName "Build" -ErrorRecord $_
  }

  Write-Step "[5/8] Parando o servico PortalCompras..."
  try {
    if (-not (Test-Path $NssmPath)) {
      throw "NSSM nao encontrado em $NssmPath."
    }

    Invoke-ExternalCommand `
      -Command $NssmPath `
      -Arguments @("stop", $ServiceName) `
      -FailureMessage "Falha ao parar o servico $ServiceName."

    Start-Sleep -Seconds 3
    $CompletedSteps.Add("Parada do servico: OK") | Out-Null
  } catch {
    Fail-Step -StepName "Parar servico" -ErrorRecord $_
  }

  Write-Step "[6/8] Iniciando o servico PortalCompras..."
  try {
    Invoke-ExternalCommand `
      -Command $NssmPath `
      -Arguments @("start", $ServiceName) `
      -FailureMessage "Falha ao iniciar o servico $ServiceName."

    Start-Sleep -Seconds 5
    $CompletedSteps.Add("Inicio do servico: OK") | Out-Null
  } catch {
    Fail-Step -StepName "Iniciar servico" -ErrorRecord $_
  }

  Write-Step "[7/8] Executando smoke test..."
  try {
    try {
      $response = Invoke-WebRequest -Uri $SmokeTestUrl -UseBasicParsing -TimeoutSec 10

      if ($response.StatusCode -eq 200) {
        $SmokeTestStatus = "OK - HTTP 200"
      } elseif ($response.Content -match "Not authenticated") {
        $SmokeTestStatus = "OK - resposta valida: Not authenticated"
      } else {
        throw "Smoke test retornou HTTP $($response.StatusCode), resposta inesperada."
      }
    } catch {
      $webResponse = $_.Exception.Response
      $statusCode = $null

      if ($webResponse) {
        $statusCode = [int]$webResponse.StatusCode
      }

      if ($statusCode -eq 401) {
        $SmokeTestStatus = "OK - HTTP 401 Not authenticated"
      } else {
        throw "Smoke test falhou por erro de conexao ou timeout: $($_.Exception.Message)"
      }
    }

    $CompletedSteps.Add("Smoke test: $SmokeTestStatus") | Out-Null
  } catch {
    $SmokeTestStatus = "FALHA - $($_.Exception.Message)"
    Fail-Step -StepName "Smoke test" -ErrorRecord $_
  }

  Write-Step "[8/8] Gravando resumo do deploy..."
  try {
    $finishedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $summaryLines = @(
      "Deploy PortalCompras - $finishedAt",
      "Diretorio: $AppDir",
      "Backup: $BackupFilePath",
      "Smoke test: $SmokeTestStatus",
      "Etapas concluidas:",
      ($CompletedSteps | ForEach-Object { "- $_" }),
      ""
    )

    $summary = $summaryLines -join [Environment]::NewLine

    Write-Host ""
    Write-Host $summary
    Add-Content -Path $DeployLogPath -Value $summary

    $CompletedSteps.Add("Log: OK ($DeployLogPath)") | Out-Null
  } catch {
    Fail-Step -StepName "Log" -ErrorRecord $_
  }
} catch {
  Write-Host ""
  Write-Host "Deploy abortado: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
