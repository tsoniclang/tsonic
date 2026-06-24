#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$#" -lt 3 || "$2" != "--" ]]; then
  echo "Usage: scripts/run-bounded.sh <label> -- <command> [args...]" >&2
  exit 2
fi

label="$1"
shift 2

safe_label="$(printf '%s' "$label" | tr -c 'A-Za-z0-9._-' '-')"
timestamp="$(date '+%Y%m%d-%H%M%S')"
log_dir=".temp/run-logs"
log_file="$log_dir/$timestamp-$safe_label.log"
summary_lines="${TSONIC_BOUNDED_LINES:-80}"

mkdir -p "$log_dir"

started_at="$(date '+%Y-%m-%d %H:%M:%S')"
set +e
"$@" >"$log_file" 2>&1
status="$?"
set -e
ended_at="$(date '+%Y-%m-%d %H:%M:%S')"

line_count="$(wc -l <"$log_file" | tr -d ' ')"
byte_count="$(wc -c <"$log_file" | tr -d ' ')"

echo "bounded-run label=$label status=$status"
echo "started=$started_at ended=$ended_at"
echo "log=$log_file lines=$line_count bytes=$byte_count"

if [[ "$line_count" == "0" ]]; then
  echo "log-summary: empty"
elif (( line_count <= summary_lines * 2 )); then
  echo "--- log ---"
  sed -n '1,$p' "$log_file"
else
  echo "--- log head ($summary_lines) ---"
  sed -n "1,${summary_lines}p" "$log_file"
  echo "--- log tail ($summary_lines) ---"
  tail -n "$summary_lines" "$log_file"
fi

exit "$status"
