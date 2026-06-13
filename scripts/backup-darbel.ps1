param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseName,

  [Parameter(Mandatory = $true)]
  [string] $DatabaseUser,

  [Parameter(Mandatory = $true)]
  [string] $DatabasePassword,

  [string] $DatabaseHost = "localhost",
  [int] $DatabasePort = 5432,
  [string] $StoragePath = "backend/storage",
  [string] $OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"

function Resolve-RequiredCommand {
  param([string] $CommandName)
  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$CommandName was not found on PATH."
  }
}

Resolve-RequiredCommand "pg_dump"

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $OutputDirectory "darbel-$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$dbFile = Join-Path $backupRoot "darbel-db-$stamp.dump"
$storageFile = Join-Path $backupRoot "darbel-storage-$stamp.zip"
$manifestFile = Join-Path $backupRoot "manifest.json"

$env:PGPASSWORD = $DatabasePassword
try {
  pg_dump `
    --host $DatabaseHost `
    --port $DatabasePort `
    --username $DatabaseUser `
    --format custom `
    --file $dbFile `
    $DatabaseName
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if (Test-Path $StoragePath) {
  Compress-Archive -Path (Join-Path $StoragePath "*") -DestinationPath $storageFile -Force
} else {
  New-Item -ItemType File -Path $storageFile -Force | Out-Null
}

$manifest = [ordered]@{
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  database = @{
    host = $DatabaseHost
    port = $DatabasePort
    name = $DatabaseName
    user = $DatabaseUser
    dump = (Split-Path $dbFile -Leaf)
  }
  storage = @{
    source = $StoragePath
    archive = (Split-Path $storageFile -Leaf)
  }
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestFile -Encoding UTF8

Write-Host "Darbel backup complete: $backupRoot"
