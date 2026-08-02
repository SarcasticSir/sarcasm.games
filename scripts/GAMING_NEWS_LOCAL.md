# Local gaming-news automation

Requirements: Windows, Git, Node.js and Codex CLI signed in with the same Windows user that runs the task.

From the repository root, run once in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-gaming-news-task.ps1
```

The task runs daily at 06:30 and again at Windows logon when that day's edition is missing. It publishes at most once per day.

Test immediately:

```powershell
Start-ScheduledTask -TaskName "SarcasmGamesGamingNews"
```

Logs and failure details are stored under `.gaming-news\`.
