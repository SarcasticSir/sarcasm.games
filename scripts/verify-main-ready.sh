#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

warn() {
  echo "[WARN] $1"
}

pass() {
  echo "[OK] $1"
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside a git repository."
fi

current_branch="$(git branch --show-current)"
if [[ -z "$current_branch" ]]; then
  fail "Detached HEAD. Checkout main before deploying."
fi

if [[ "$current_branch" != "main" ]]; then
  fail "Current branch is '$current_branch'. Expected 'main'."
fi
pass "Current branch is main."

if ! git remote get-url origin >/dev/null 2>&1; then
  fail "Missing git remote 'origin'. Add origin before deploying."
fi
pass "Remote origin exists."

if ! git fetch --quiet origin main; then
  fail "Could not fetch origin/main. Check network/authentication."
fi
pass "Fetched origin/main."

local_main="$(git rev-parse main)"
remote_main="$(git rev-parse origin/main)"

if [[ "$local_main" != "$remote_main" ]]; then
  warn "Local main and origin/main differ."
  echo "       local : $local_main"
  echo "       remote: $remote_main"
  fail "Run 'git pull --rebase origin main' or push the missing commits before deploy."
fi
pass "Local main is in sync with origin/main."

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Working tree is dirty. Commit or stash changes before deploying."
fi
pass "Working tree is clean."

echo "\nReady: repository is on main, synced with origin/main, and clean."
