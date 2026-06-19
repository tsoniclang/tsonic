#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! git rev-parse --verify main >/dev/null 2>&1; then
  echo "FAIL: local main branch is missing." >&2
  exit 1
fi

current_branch="$(git branch --show-current)"
status=0

while IFS= read -r branch; do
  [[ -z "$branch" ]] && continue
  [[ "$branch" == "$current_branch" ]] && continue
  ahead_count="$(git rev-list --count "main..$branch")"
  if [[ "$ahead_count" != "0" ]]; then
    echo "WARN: local branch '$branch' is $ahead_count commit(s) ahead of main." >&2
    status=1
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads)

if [[ "$status" == "0" ]]; then
  echo "Branch hygiene: clean"
fi

exit "$status"
