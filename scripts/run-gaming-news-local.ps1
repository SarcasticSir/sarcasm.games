param(
  [string]$RepoPath = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$RepoPath = (Resolve-Path $RepoPath).Path
$WorkDir = Join-Path $RepoPath '.gaming-news'
$LogDir = Join-Path $WorkDir 'logs'
$LogFile = Join-Path $LogDir ("run-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
$OutputFile = Join-Path $WorkDir 'codex-output.json'
$SchemaFile = Join-Path $RepoPath 'scripts\gaming-news-output.schema.json'
$PromptFile = Join-Path $RepoPath 'scripts\gaming-news-codex-prompt.md'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  $line | Tee-Object -FilePath $LogFile -Append
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
  )
  Write-Log ("> {0} {1}" -f $Command, ($Arguments -join ' '))
  & $Command @Arguments 2>&1 | Tee-Object -FilePath $LogFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "$Command exited with code $LASTEXITCODE."
  }
}

try {
  Set-Location $RepoPath
  foreach ($command in @('git', 'node', 'codex')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
      throw "Required command '$command' was not found in PATH."
    }
  }

  Invoke-Checked codex login status

  $dirty = git status --porcelain
  if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect the Git working tree.' }
  if ($dirty) { throw 'The repository has uncommitted changes. Commit or discard them before the scheduled news run.' }

  Invoke-Checked git switch main
  Invoke-Checked git pull --ff-only origin main

  $today = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'W. Europe Standard Time').ToString('yyyy-MM-dd')
  $automationFile = Join-Path $RepoPath 'news\data\automation.json'
  if (Test-Path $automationFile) {
    try {
      $automation = Get-Content $automationFile -Raw | ConvertFrom-Json
      if ($automation.date -eq $today -and $automation.provider -eq 'codex-local') {
        Write-Log "A validated local Codex edition already exists for $today. Nothing to do."
        exit 0
      }
    } catch {
      Write-Log 'Existing automation marker could not be read; continuing with publication.'
    }
  }

  Invoke-Checked node --test scripts/gaming-news.test.mjs
  Invoke-Checked node scripts/install-gaming-news.mjs
  Invoke-Checked node scripts/gaming-news-local.mjs prepare

  Remove-Item $OutputFile -Force -ErrorAction SilentlyContinue
  $prompt = Get-Content $PromptFile -Raw
  $codexArguments = @(
    '--ask-for-approval', 'never',
    'exec',
    '--cd', $RepoPath,
    '--sandbox', 'read-only',
    '--ephemeral',
    '--output-schema', $SchemaFile,
    '--output-last-message', $OutputFile,
    $prompt
  )
  Write-Log '> codex exec [structured local rewrite]'
  & codex @codexArguments 2>&1 | Tee-Object -FilePath $LogFile -Append
  if ($LASTEXITCODE -ne 0) { throw "Codex exited with code $LASTEXITCODE." }
  if (-not (Test-Path $OutputFile)) { throw 'Codex did not create its structured output file.' }

  Invoke-Checked node scripts/gaming-news-local.mjs publish $OutputFile
  Invoke-Checked node scripts/validate-gaming-news.mjs

  Invoke-Checked git add index.html news/data
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Log 'No publication changes were produced.'
    exit 0
  }
  if ($LASTEXITCODE -ne 1) { throw 'Unable to inspect staged publication changes.' }

  Invoke-Checked git config user.name 'SarcasticSir'
  Invoke-Checked git config user.email '167876826+SarcasticSir@users.noreply.github.com'
  Invoke-Checked git commit -m 'Publish rewritten gaming news [skip ci]'
  Invoke-Checked git push origin main
  Remove-Item (Join-Path $WorkDir 'FAILED.txt') -Force -ErrorAction SilentlyContinue
  Write-Log 'Gaming-news publication completed successfully.'
} catch {
  $message = $_.Exception.Message
  Write-Log "FAILED: $message"
  Set-Content -Path (Join-Path $WorkDir 'FAILED.txt') -Value @(
    "Gaming-news publication failed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss').",
    $message,
    "Log: $LogFile"
  )
  try { & msg.exe $env:USERNAME "Gaming news failed. See $WorkDir\FAILED.txt" | Out-Null } catch {}
  exit 1
}
