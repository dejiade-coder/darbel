param(
  [switch] $RunSmokeWorkflow,
  [string] $FrontendUrl = 'http://localhost:3000/login',
  [string] $BackendHealthUrl = 'http://localhost:4000/api/v1/health/live'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

function Step {
  param([string] $Name)
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
}

function Invoke-Checked {
  param(
    [string] $Command,
    [string] $WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    Invoke-Expression $Command
  } finally {
    Pop-Location
  }
}

function Test-Url {
  param([string] $Url)
  $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 12
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 500) {
    throw "Unexpected status $($response.StatusCode) from $Url"
  }
  Write-Host "OK $($response.StatusCode): $Url" -ForegroundColor Green
}

Step 'Backend build'
Invoke-Checked 'npm.cmd run build' $backend

Step 'Frontend build'
Invoke-Checked 'npm.cmd run build' $frontend

Step 'Prisma schema validation'
Invoke-Checked 'npx.cmd prisma validate' $backend

Step 'Database migrations'
Push-Location $backend
try {
  $envFile = Join-Path $backend '.env'
  if (Test-Path $envFile) {
    $migratorLine = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_MIGRATOR_URL=' } | Select-Object -First 1
    if ($migratorLine) {
      $env:DATABASE_URL = $migratorLine.Substring('DATABASE_MIGRATOR_URL='.Length)
    }
  }
  npm.cmd run prisma:migrate:deploy
} finally {
  Pop-Location
}

Step 'Runtime health checks'
Test-Url $BackendHealthUrl
Test-Url $FrontendUrl

if ($RunSmokeWorkflow) {
  Step 'End-to-end workflow smoke test'
  Invoke-Checked 'node scripts/smoke-workflow.js' $root
} else {
  Write-Host ""
  Write-Host 'Skipping workflow smoke test. Pass -RunSmokeWorkflow with DARBEL_ADMIN_EMAIL and DARBEL_ADMIN_PASSWORD to run it.' -ForegroundColor Yellow
}

Step 'Git status'
Push-Location $root
try {
  git status --short --branch
} finally {
  Pop-Location
}

Write-Host ""
Write-Host 'Release check completed.' -ForegroundColor Green
