#!/usr/bin/env bash
# -------------------------------------------------------------------
# clean.sh – Clean build artifacts and node_modules across all packages
# -------------------------------------------------------------------
set -euo pipefail

# Change to the project root directory
cd "$(dirname "$0")/.."

echo "=== Cleaning Tsonic build artifacts ==="

# Define packages
PACKAGES=(
  "runtime"
  "frontend"
  "emitter"
  "backend"
  "cli"
)

# Clean dist directories in all packages
for pkg_name in "${PACKAGES[@]}"; do
  pkg="packages/$pkg_name"
  if [[ -d "$pkg/dist" ]]; then
    echo "Removing $pkg/dist"
    rm -rf "$pkg/dist"
  fi
done

# Clean any .tsbuildinfo files
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true

# Clean .tsonic build directory
if [[ -d ".tsonic" ]]; then
  echo "Removing .tsonic build directory"
  rm -rf .tsonic
fi

# Clean output directory
if [[ -d "out" ]]; then
  echo "Removing out directory"
  rm -rf out
fi

# Clean root node_modules if --all flag is passed
if [[ "${1:-}" == "--all" ]]; then
  if [[ -d "node_modules" ]]; then
    echo "Removing root node_modules"
    rm -rf node_modules
  fi

  # Clean node_modules from all packages
  for pkg_name in "${PACKAGES[@]}"; do
    pkg="packages/$pkg_name"
    if [[ -d "$pkg/node_modules" ]]; then
      echo "Removing $pkg/node_modules"
      rm -rf "$pkg/node_modules"
    fi
  done

  # Remove package-lock.json to ensure clean reinstall
  if [[ -f "package-lock.json" ]]; then
    echo "Removing package-lock.json"
    rm -f package-lock.json
  fi
fi

echo "=== Clean completed ===="