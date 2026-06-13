param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseName,

  [Parameter(Mandatory = $true)]
  [string] $DatabaseUser,

  [Parameter(Mandatory = $true)]
  [string] $DatabasePassword,

  [Parameter(Mandatory = $true)]
  [string] $DatabaseDumpPath,

  [string] $DatabaseHost = "localhost",
  [int] $DatabasePort = 5432,
  [string] $StorageArchivePath,
  [string] $StoragePath = "backend/storage",
  [switch] $SkipDatabaseClean
)

$ErrorActionPreference = "Stop"

function Resolve-RequiredCommand {
  param([string] $CommandName)
  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$CommandName was not found on PATH."
  }
}

Resolve-RequiredCommand "pg_restore"

if (-not (Test-Path $DatabaseDumpPath)) {
  throw "Database dump was not found: $DatabaseDumpPath"
}

$restoreArgs = @(
  "--host", $DatabaseHost,
  "--port", $DatabasePort,
  "--username", $DatabaseUser,
  "--dbname", $DatabaseName,
  "--if-exists"
)

if (-not $SkipDatabaseClean) {
  $restoreArgs += "--clean"
}

$restoreArgs += $DatabaseDumpPath

$env:PGPASSWORD = $DatabasePassword
try {
  & pg_restore @restoreArgs
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if ($StorageArchivePath) {
  if (-not (Test-Path $StorageArchivePath)) {
    throw "Storage archive was not found: $StorageArchivePath"
  }
  New-Item -ItemType Directory -Force -Path $StoragePath | Out-Null
  Expand-Archive -Path $StorageArchivePath -DestinationPath $StoragePath -Force
}

Write-Host "Darbel restore complete. Run the post-restore verification checklist before using this environment."
