param([switch]$NoBrowser, [int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$url = "http://127.0.0.1:$Port"
function Get-WorkbenchSession {
    try { return Invoke-RestMethod -Uri "$url/api/session" -TimeoutSec 2 } catch { return $null }
}
$session = Get-WorkbenchSession
if ($session -and $session.app -ne 'primary-chinese-workbench') {
    throw "Port $Port is occupied by another service."
}
if (-not $session) {
    $python = (Get-Command python.exe -ErrorAction Stop).Source
    $dataDir = Join-Path $appRoot 'data'
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    $serverPath = Join-Path $appRoot 'server.py'
    $process = Start-Process -FilePath $python -ArgumentList @('"' + $serverPath + '"', '--port', "$Port") -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $dataDir 'server.log') -RedirectStandardError (Join-Path $dataDir 'server-error.log')
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 250
        $session = Get-WorkbenchSession
        if ($session -or $process.HasExited) { break }
    }
    if (-not $session -or $session.app -ne 'primary-chinese-workbench' -or $session.storage -ne 'SQLite') {
        throw "SQLite service failed to start. See $dataDir\server-error.log"
    }
    Set-Content -LiteralPath (Join-Path $dataDir 'server.pid') -Value $process.Id
}
Write-Output "SQLite workbench: $url"
Write-Output "Database: $(Join-Path $appRoot 'data\workbench.sqlite3')"
if (-not $NoBrowser) { Start-Process $url }
