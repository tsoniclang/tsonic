#!/bin/bash
# Helper script to run a single E2E test fixture

set -euo pipefail

# Arguments
FIXTURE_NAME=$1
OUTPUT_DIR=$2
BCL_TYPES_DIR=$3

# Paths
PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TSONIC_CLI="$PROJECT_ROOT/packages/cli/dist/index.js"
LOG_FILE="$OUTPUT_DIR/test.log"

# Redirect all output to log file
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running test: $FIXTURE_NAME"

# Change to test directory
cd "$OUTPUT_DIR"

# Step 1: Check for required files
if [ ! -f "tsonic.json" ]; then
    echo "ERROR: tsonic.json not found in fixture"
    exit 1
fi

# Check for entry point (could be main.ts or index.ts)
ENTRY_POINT=$(grep '"entryPoint"' tsonic.json | sed 's/.*"entryPoint".*:.*"\(.*\)".*/\1/')
if [ ! -f "$ENTRY_POINT" ]; then
    echo "ERROR: Entry point $ENTRY_POINT not found in fixture"
    exit 1
fi

# Step 2: Install dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    npm install --silent || {
        echo "ERROR: npm install failed"
        exit 1
    }
fi

# Step 3: Build the project
echo "Building project..."

# Check if fixture needs BCL types
if grep -q '"libraries"' tsonic.json 2>/dev/null; then
    # Convert relative BCL path to absolute
    ABS_BCL_DIR="$(cd "$PROJECT_ROOT" && cd "$BCL_TYPES_DIR" && pwd)"
    echo "Using BCL types from: $ABS_BCL_DIR"
    "$TSONIC_CLI" build "$ENTRY_POINT" \
        --lib "$ABS_BCL_DIR" \
        --keep-temp \
        --quiet || {
        echo "ERROR: Build failed"
        exit 1
    }
else
    # Build without BCL library
    "$TSONIC_CLI" build "$ENTRY_POINT" \
        --keep-temp \
        --quiet || {
        echo "ERROR: Build failed"
        exit 1
    }
fi

# Step 4: Check if executable was created
EXECUTABLE_NAME=$(grep '"outputName"' tsonic.json | sed 's/.*"outputName".*:.*"\(.*\)".*/\1/')
if [ -z "$EXECUTABLE_NAME" ]; then
    EXECUTABLE_NAME="tsonic-app"
fi

if [ "$(uname)" = "Darwin" ] || [ "$(uname)" = "Linux" ]; then
    EXECUTABLE="./$EXECUTABLE_NAME"
else
    EXECUTABLE="./$EXECUTABLE_NAME.exe"
fi

if [ ! -f "$EXECUTABLE" ]; then
    echo "ERROR: Executable not found: $EXECUTABLE"
    exit 1
fi

# Step 5: Run the executable and capture output
echo "Running executable..."
ACTUAL_OUTPUT_FILE="$OUTPUT_DIR/actual-output.txt"
if timeout 10 "$EXECUTABLE" > "$ACTUAL_OUTPUT_FILE" 2>&1; then
    echo "Executable ran successfully"
else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
        echo "ERROR: Executable timed out after 10 seconds"
        exit 1
    else
        echo "ERROR: Executable failed with exit code $EXIT_CODE"
        exit 1
    fi
fi

# Step 6: Validate output if expected output exists
EXPECTED_OUTPUT_FILE="$OUTPUT_DIR/expected-output.txt"
if [ -f "$EXPECTED_OUTPUT_FILE" ]; then
    echo "Validating output..."
    if diff -u "$EXPECTED_OUTPUT_FILE" "$ACTUAL_OUTPUT_FILE" > "$OUTPUT_DIR/output-diff.txt"; then
        echo "Output matches expected!"
    else
        echo "ERROR: Output mismatch"
        echo "--- Expected output ---"
        cat "$EXPECTED_OUTPUT_FILE"
        echo "--- Actual output ---"
        cat "$ACTUAL_OUTPUT_FILE"
        echo "--- Diff ---"
        cat "$OUTPUT_DIR/output-diff.txt"
        exit 1
    fi
else
    echo "No expected output file, skipping validation"
fi

# Step 7: Run additional test script if exists
if [ -f "test.sh" ]; then
    echo "Running additional test script..."
    bash test.sh || {
        echo "ERROR: Additional test script failed"
        exit 1
    }
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Test completed successfully: $FIXTURE_NAME"
exit 0