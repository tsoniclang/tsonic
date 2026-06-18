#!/usr/bin/env bash
set -euo pipefail

scratch_roots=("workarea" ".temp" ".tests")

# Active repositories for the Tsonic compiler architecture. Downstream projects,
# archived package-surface repositories, and historical binding-package repos are
# intentionally outside this check so they do not block compiler work.
active_repo_names=(
  "tsonic"
  "tsts"
  "tsonic-csharp"
  "csharp-runtime"
  "csharp-js"
  "csharp-nodejs"
  "tsonic-rust"
  "rust-runtime"
  "rust-js"
  "rust-nodejs"
  "tsonic.org"
)

is_scratch_root_name() {
  local name="$1"
  local scratch_root
  for scratch_root in "${scratch_roots[@]}"; do
    if [[ "$name" == "$scratch_root" ]]; then
      return 0
    fi
  done
  return 1
}

script_workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if is_scratch_root_name "$(basename "$script_workspace_root")"; then
  script_workspace_root="$(cd "$script_workspace_root/.." && pwd)"
fi

workspace_root="${1:-$script_workspace_root}"
stale_days="${STALE_DAYS:-7}"
now_epoch="$(date +%s)"

if [[ ! -d "$workspace_root" ]]; then
  echo "error: workspace root does not exist: $workspace_root" >&2
  exit 2
fi

warn_count=0
repo_count=0
script_repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel 2>/dev/null || true)"

warn() {
  printf 'WARN  %s\n' "$1"
  warn_count=$((warn_count + 1))
}

check_repo() {
  local repo="$1"
  [[ -d "$repo/.git" ]] || return 0
  repo_count=$((repo_count + 1))
  repo_name="$(basename "$repo")"

  current_branch="$(git -C "$repo" branch --show-current)"
  dirty_count="$(git -C "$repo" status --porcelain | wc -l | tr -d ' ')"
  is_current_work_repo=false
  if [[ -n "$script_repo_root" && "$(cd "$repo" && pwd)" == "$script_repo_root" ]]; then
    is_current_work_repo=true
  fi

  if [[ "$current_branch" != "main" && "$is_current_work_repo" != true ]]; then
    warn "$repo_name: current branch is '$current_branch' (expected 'main')"
  fi

  if [[ "$dirty_count" != "0" ]]; then
    warn "$repo_name: working tree is dirty ($dirty_count path(s))"
  fi

  while IFS='|' read -r branch commit_epoch; do
    [[ -n "$branch" ]] || continue
    if [[ "$is_current_work_repo" == true && "$branch" == "$current_branch" ]]; then
      continue
    fi
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
}

for active_repo_name in "${active_repo_names[@]}"; do
  repo="$workspace_root/$active_repo_name"
  if [[ ! -d "$repo/.git" ]]; then
    warn "$active_repo_name: active repository is not cloned at $repo"
    continue
  fi
  check_repo "$repo"
done

if (( warn_count > 0 )); then
  printf '\nBranch hygiene check failed: %d warning(s) across %d repo(s).\n' "$warn_count" "$repo_count" >&2
  exit 1
fi

printf 'Branch hygiene check passed: %d repo(s), no warnings.\n' "$repo_count"
