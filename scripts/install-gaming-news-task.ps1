param(
  [string]$RepoPath = (Split-Path $PSScriptRoot -Parent),
  [string]$DailyTime = '06:30',
  [string]$TaskName = 'SarcasmGamesGamingNews'
)

$ErrorActionPreference = 'Stop'
$RepoPath = (Resolve-Path $RepoPath).Path
$Runner = Join-Path $RepoPath 'scripts\run-gaming-news-local.ps1'

foreach ($command in @('git', 'node', 'codex')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command '$command' was not found in PATH."
  }
}

& codex login status
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Codex is not signed in. Complete the browser sign-in once.'
  & codex login
  if ($LASTEXITCODE -ne 0) { throw 'Codex login was not completed.' }
}

$at = [DateTime]::ParseExact($DailyTime, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" -RepoPath `"$RepoPath`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $RepoPath
$triggers = @(
  (New-ScheduledTaskTrigger -Daily -At $at)
  (New-ScheduledTaskTrigger -AtLogOn -User $currentUser)
)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Principal $principal `
  -Settings $settings `
  -Description 'Collects, rewrites, validates, commits and publishes the daily sarcasm.games gaming-news edition using local Codex.' `
  -Force | Out-Null

Write-Host "Scheduled task '$TaskName' installed."
Write-Host "Daily time: $DailyTime"
Write-Host 'A missed run starts at the next Windows logon. The runner publishes at most once per day.'
Write-Host "Test now with: Start-ScheduledTask -TaskName '$TaskName'"
