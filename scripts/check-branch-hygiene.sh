#!/usr/bin/env bash
set -euo pipefail

workspace_root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
stale_days="${STALE_DAYS:-7}"
now_epoch="$(date +%s)"

if [[ ! -d "$workspace_root" ]]; then
  echo "error: workspace root does not exist: $workspace_root" >&2
  exit 2
fi

warn_count=0
repo_count=0

warn() {
  printf 'WARN  %s\n' "$1"
  warn_count=$((warn_count + 1))
}

while IFS= read -r repo; do
  [[ -d "$repo/.git" ]] || continue
  repo_count=$((repo_count + 1))
  repo_name="$(basename "$repo")"

  current_branch="$(git -C "$repo" branch --show-current)"
  dirty_count="$(git -C "$repo" status --porcelain | wc -l | tr -d ' ')"

  if [[ "$current_branch" != "main" ]]; then
    warn "$repo_name: current branch is '$current_branch' (expected 'main')"
  fi

  if [[ "$dirty_count" != "0" ]]; then
    warn "$repo_name: working tree is dirty ($dirty_count path(s))"
  fi

  while IFS='|' read -r branch commit_epoch; do
    [[ -n "$branch" ]] || continue
    ahead_behind="$(git -C "$repo" rev-list --left-right --count "main...$branch" 2>/dev/null || echo '0 0')"
    ahead="$(awk '{print $2}' <<<"$ahead_behind")"
    behind="$(awk '{print $1}' <<<"$ahead_behind")"
    age_days="$(((now_epoch - commit_epoch) / 86400))"

    reasons=()
    if [[ "$ahead" != "0" ]]; then
      reasons+=("ahead=${ahead}")
    fi
    if [[ "$behind" != "0" ]]; then
      reasons+=("behind=${behind}")
    fi
    if (( age_days >= stale_days )); then
      reasons+=("stale=${age_days}d")
    fi
    if [[ ${#reasons[@]} -eq 0 ]]; then
      reasons+=("non-main-local-branch")
    fi

    warn "$repo_name: branch '$branch' (${reasons[*]})"
  done < <(
    git -C "$repo" for-each-ref \
      --format='%(refname:short)|%(committerdate:unix)' \
      refs/heads \
      | grep -v '^main|' || true
  )
done < <(find "$workspace_root" -mindepth 1 -maxdepth 1 -type d | sort)

if (( warn_count > 0 )); then
  printf '\nBranch hygiene check failed: %d warning(s) across %d repo(s).\n' "$warn_count" "$repo_count" >&2
  exit 1
fi

printf 'Branch hygiene check passed: %d repo(s), no warnings.\n' "$repo_count"
