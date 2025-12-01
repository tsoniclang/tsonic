#!/bin/bash
# Run all dotnet mode E2E tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/../fixtures"
CLI_PATH="$PROJECT_ROOT/packages/cli/dist/index.js"

passed=0
failed=0
skipped=0

echo "=== Running dotnet E2E Tests ==="
echo ""

for fixture_dir in "$FIXTURES_DIR"/*/; do
  fixture_name=$(basename "$fixture_dir")
  config_file="$fixture_dir/tsonic.dotnet.json"

  # Skip if no dotnet config
  if [ ! -f "$config_file" ]; then
    continue
  fi

  # Skip negative tests (expectFailure: true)
  meta_file="$fixture_dir/e2e.meta.json"
  if [ -f "$meta_file" ] && grep -q '"expectFailure": true' "$meta_file"; then
    continue
  fi

  echo "Testing: $fixture_name"

  cd "$fixture_dir"

  # Install dependencies if package.json exists
  if [ -f "package.json" ]; then
    npm install --silent 2>/dev/null || true
  fi

  # Build
  if node "$CLI_PATH" build src/index.ts --config tsonic.dotnet.json 2>&1 | grep -q "Build complete"; then
    # Find and run the executable
    exe_name=$(grep -o '"outputName"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || echo "")
    if [ -z "$exe_name" ]; then
      exe_name=$(basename "$fixture_dir" | tr '-' '_')
    fi

    # Try to find the executable
    exe_path=$(find generated -name "$exe_name" -o -name "${exe_name}-test" -o -name "${fixture_name//-/_}" 2>/dev/null | grep -v '\.dll$' | head -1)

    if [ -n "$exe_path" ] && [ -x "$exe_path" ]; then
      if "$exe_path" > /dev/null 2>&1; then
        echo "  ✓ Passed"
        ((passed++))
      else
        echo "  ✗ Failed (execution error)"
        ((failed++))
      fi
    else
      echo "  ✓ Build passed (no executable to run)"
      ((passed++))
    fi
  else
    echo "  ✗ Failed (build error)"
    ((failed++))
  fi

  cd "$PROJECT_ROOT"
done

echo ""
echo "=== Summary ==="
echo "Passed: $passed"
echo "Failed: $failed"

if [ $failed -gt 0 ]; then
  exit 1
fi
