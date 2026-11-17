#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

arguments=(--with-preruns --scope tsonic --group-prefix host-cli-build)
while (( $# > 0 )); do
  case "$1" in
    --filter)
      if (( $# < 2 )); then
        printf '%s\n' '--filter requires a task substring.' >&2
        exit 2
      fi
      arguments+=(--match "$2")
      shift 2
      ;;
    *)
      arguments+=("$1")
      shift
      ;;
  esac
done

exec node test/scripts/run-parallel.mjs "${arguments[@]}"
