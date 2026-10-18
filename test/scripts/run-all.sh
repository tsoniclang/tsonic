#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if [[ "${1:-}" == "--train" ]]; then
  if (( $# != 3 )); then
    printf '%s\n' 'Usage: run-all.sh --train <previous-results.json> <new-output-directory>' >&2
    exit 2
  fi
  previous="$(node --input-type=module -e 'import{resolve}from"node:path";console.log(resolve(process.argv[1]))' "$2")"
  output="$(node --input-type=module -e 'import{resolve}from"node:path";console.log(resolve(process.argv[1]))' "$3")"
  if [[ ! -f "$previous" || -e "$output" ]]; then
    printf '%s\n' 'A complete previous result is required; the new output directory must not exist.' >&2
    exit 2
  fi
  node test/scripts/test-results.mjs compare "$previous" "$previous" > /dev/null
  mkdir -p "$output"
  host_root="$PWD"
  host_status=0
  TSONIC_TEST_SUITE_REPORT="$output/host.json" TSONIC_TEST_GUARD_REPORT="$output/host.guard.json" \
    bash test/scripts/run-parallel.sh --with-preruns || host_status=$?
  rust_root="${TSONICLANG_WORKSPACE_ROOT:-$(dirname "$PWD")}/tsonic-rust"
  mapfile -d '' -t rust_files < <(node test/scripts/node-test-files.mjs "$rust_root/test")
  if (( ${#rust_files[@]} == 0 )); then exit 2; fi
  rust_status=0
  (cd "$rust_root"; TSONIC_ROOT="$host_root" \
    TSONIC_TEST_SUITE_REPORT="$output/rust.json" TSONIC_TEST_GUARD_REPORT="$output/rust.guard.json" \
    bash scripts/test.sh "${rust_files[@]}") || rust_status=$?
  printf 'host=%s rust=%s\n' "$host_status" "$rust_status" > "$output/runner-status.txt"
  node test/scripts/test-results.mjs train "$previous" "$output"
  exit "$?"
fi

if (( $# == 0 )); then
  exec node scripts/certification/run.mjs tsonic
fi

arguments=(--with-preruns)
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
    --no-unit)
      arguments+=(--scope tsonic --group-prefix host-cli-build)
      shift
      ;;
    *)
      arguments+=("$1")
      shift
      ;;
  esac
done

exec bash test/scripts/bounded-run.sh host node test/scripts/run-parallel.mjs "${arguments[@]}"
