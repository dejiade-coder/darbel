param(
  [switch]$Restart,
  [int]$FrontendPort = 3000,
  [int]$BackendPort = 4000
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Stop-PortProcess {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $pids) {
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Start-App {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string[]]$Arguments,
    [string]$OutputLog,
    [string]$ErrorLog
  )

  $argumentText = ($Arguments | ForEach-Object { $_ }) -join ' '
  $command = "cd /d `"$WorkingDirectory`" && `"$npm`" $argumentText > `"$OutputLog`" 2> `"$ErrorLog`""
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = 'cmd.exe'
  $startInfo.Arguments = "/c $command"
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $process = [System.Diagnostics.Process]::Start($startInfo)

  [PSCustomObject]@{
    Name = $Name
    PID = $process.Id
    Log = $OutputLog
  }
}

function Wait-ForUrl {
  param(
    [string]$Name,
    [string]$Url,
    [int]$Seconds = 45
  )

  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host "$Name is ready: $Url" -ForegroundColor Green
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  Write-Warning "$Name did not respond within $Seconds seconds: $Url"
}

if ($Restart) {
  Stop-PortProcess -Port $FrontendPort
  Stop-PortProcess -Port $BackendPort
  Start-Sleep -Seconds 2
}

$backendRun = Start-App `
  -Name 'backend' `
  -WorkingDirectory $backend `
  -Arguments @('run', 'start:dev') `
  -OutputLog (Join-Path $root "backend-live-$stamp.log") `
  -ErrorLog (Join-Path $root "backend-dev-$stamp.err.log")

$frontendRun = Start-App `
  -Name 'frontend' `
  -WorkingDirectory $frontend `
  -Arguments @('run', 'dev') `
  -OutputLog (Join-Path $root "frontend-live-$stamp.log") `
  -ErrorLog (Join-Path $root "frontend-dev-$stamp.err.log")

$backendRun
$frontendRun

Wait-ForUrl -Name 'Backend' -Url "http://localhost:$BackendPort/api/v1/health/live"
Wait-ForUrl -Name 'Frontend' -Url "http://localhost:$FrontendPort/login"

Write-Host ''
Write-Host "Darbel is running:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:$FrontendPort"
Write-Host "  Backend:  http://localhost:$BackendPort/api/v1"
Write-Host ''
Write-Host 'Logs:'
Write-Host "  Backend:  $($backendRun.Log)"
Write-Host "  Frontend: $($frontendRun.Log)"
