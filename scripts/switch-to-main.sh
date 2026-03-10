#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[FAIL] Not inside a git repository." >&2
  exit 1
fi

if git show-ref --verify --quiet refs/heads/main; then
  git checkout main
  echo "[OK] Switched to existing local branch 'main'."
  exit 0
fi

if git remote get-url origin >/dev/null 2>&1; then
  if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
    git fetch origin main
    git checkout -b main origin/main
    echo "[OK] Created local 'main' from origin/main and switched to it."
    exit 0
  fi
fi

git checkout -b main

echo "[WARN] Created local 'main' without remote tracking."
echo "       Run: git branch --set-upstream-to=origin/main main"
