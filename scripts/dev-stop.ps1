param(
  [int[]]$Ports = @(3000, 4000)
)

$ErrorActionPreference = 'Stop'

foreach ($port in $Ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

  if (-not $pids) {
    Write-Host "No process is listening on port $port."
    continue
  }

  foreach ($processId in $pids) {
    if (-not $processId -or $processId -eq $PID) { continue }
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Write-Host "Stopping $($process.ProcessName) PID $processId on port $port..."
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}
