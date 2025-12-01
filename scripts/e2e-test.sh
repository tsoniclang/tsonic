#!/bin/bash
# E2E Test Runner for Tsonic
# Tests the complete pipeline: TypeScript → IR → C# → NativeAOT executable
# Supports dual-mode testing: dotnet and js runtime modes

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FIXTURES_DIR="$SCRIPT_DIR/harness/fixtures"
HELPERS_DIR="$SCRIPT_DIR/harness/helpers"
TESTS_OUTPUT_DIR="$PROJECT_ROOT/.tests/e2e"

# Variables
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
VERBOSE=${VERBOSE:-0}
MODE=${MODE:-"both"}  # dotnet, js, or both

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo ""
    echo "========================================"
    echo "$1"
    echo "========================================"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if tsonic is built
    if [ ! -f "$PROJECT_ROOT/packages/cli/dist/index.js" ]; then
        log_error "Tsonic CLI not built. Run ./scripts/build.sh first."
        exit 1
    fi
    log_success "Tsonic CLI found"

    # Check if dotnet is installed
    if ! command -v dotnet &> /dev/null; then
        log_error "dotnet CLI not found. Please install .NET SDK."
        exit 1
    fi
    log_success "dotnet CLI found ($(dotnet --version))"

    log_info "Running in mode: $MODE"
}

# Clean test output directory
clean_output() {
    log_info "Cleaning test output directory..."
    rm -rf "$TESTS_OUTPUT_DIR"
    mkdir -p "$TESTS_OUTPUT_DIR"
}

# Get supported modes for a fixture
get_supported_modes() {
    local fixture_path=$1
    local meta_file="$fixture_path/e2e.meta.json"

    if [ -f "$meta_file" ]; then
        # Read modes from meta file
        local modes=$(grep -o '"modes".*\[.*\]' "$meta_file" | grep -oE '\["[^"]*"(,"[^"]*")*\]' | tr -d '[]"' | tr ',' ' ')
        echo "$modes"
    else
        # Default: both modes if configs exist
        local modes=""
        [ -f "$fixture_path/tsonic.dotnet.json" ] && modes="$modes dotnet"
        [ -f "$fixture_path/tsonic.js.json" ] && modes="$modes js"
        echo "$modes"
    fi
}

# Run a single test fixture in a specific mode
run_test_mode() {
    local fixture_name=$1
    local runtime_mode=$2
    local fixture_path="$FIXTURES_DIR/$fixture_name"
    local output_dir="$TESTS_OUTPUT_DIR/$fixture_name/$runtime_mode"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo ""
    echo "  [$runtime_mode] Testing: $fixture_name"

    # Check for required config file
    local config_file="$fixture_path/tsonic.$runtime_mode.json"
    if [ ! -f "$config_file" ]; then
        log_error "Config not found: tsonic.$runtime_mode.json"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi

    # Check for expected output
    local expected_file="$fixture_path/expected/$runtime_mode.txt"
    if [ ! -f "$expected_file" ]; then
        log_warning "Expected output not found: expected/$runtime_mode.txt"
    fi

    # Create output directory
    mkdir -p "$output_dir"

    # Copy fixture to output directory
    cp -r "$fixture_path"/src "$output_dir/"
    [ -f "$fixture_path/package.json" ] && cp "$fixture_path/package.json" "$output_dir/"
    [ -f "$fixture_path/package-lock.json" ] && cp "$fixture_path/package-lock.json" "$output_dir/"
    [ -f "$fixture_path/tsconfig.json" ] && cp "$fixture_path/tsconfig.json" "$output_dir/"

    # Copy the mode-specific config as tsonic.json
    cp "$config_file" "$output_dir/tsonic.json"

    # Copy expected output
    if [ -f "$expected_file" ]; then
        cp "$expected_file" "$output_dir/expected-output.txt"
    fi

    # Run the test using helper script
    if "$HELPERS_DIR/run-single-test.sh" "$fixture_name" "$output_dir" "$runtime_mode"; then
        log_success "[$runtime_mode] Test passed: $fixture_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "[$runtime_mode] Test failed: $fixture_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ "$VERBOSE" -eq 1 ]; then
            echo "--- Error details ---"
            tail -30 "$output_dir/test.log" 2>/dev/null || echo "No log file found"
            echo "---"
        fi
        return 1
    fi
}

# Run a single test fixture (all applicable modes)
run_test() {
    local fixture_name=$1
    local fixture_path="$FIXTURES_DIR/$fixture_name"

    if [ ! -d "$fixture_path" ]; then
        log_error "Fixture not found: $fixture_name"
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi

    echo ""
    echo "----------------------------------------"
    echo "Testing: $fixture_name"
    echo "----------------------------------------"

    # Get supported modes for this fixture
    local supported_modes=$(get_supported_modes "$fixture_path")

    if [ -z "$supported_modes" ]; then
        log_warning "No config files found for $fixture_name (need tsonic.dotnet.json or tsonic.js.json)"
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi

    # Run tests for each applicable mode
    local test_failed=0
    for supported_mode in $supported_modes; do
        # Check if this mode should be run based on --mode flag
        if [ "$MODE" = "both" ] || [ "$MODE" = "$supported_mode" ]; then
            if ! run_test_mode "$fixture_name" "$supported_mode"; then
                test_failed=1
            fi
        fi
    done

    return $test_failed
}

# Run all tests or specific tests
run_tests() {
    print_header "Running E2E Tests"

    if [ $# -gt 0 ]; then
        # Run specific tests
        for test_name in "$@"; do
            run_test "$test_name"
        done
    else
        # Run all tests in fixtures directory
        for fixture_dir in "$FIXTURES_DIR"/*; do
            if [ -d "$fixture_dir" ]; then
                fixture_name=$(basename "$fixture_dir")
                run_test "$fixture_name"
            fi
        done
    fi
}

# Print summary
print_summary() {
    print_header "Test Summary"

    echo "Mode: $MODE"
    echo "Total tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        log_success "All tests passed! 🎉"
        exit 0
    else
        echo ""
        log_error "Some tests failed. Run with VERBOSE=1 for details."
        exit 1
    fi
}

# Main execution
main() {
    cd "$PROJECT_ROOT"

    check_prerequisites
    clean_output

    # Pass any arguments to run_tests (for running specific tests)
    run_tests "$@"

    print_summary
}

# Handle script arguments
TEST_ARGS=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=1
            shift
            ;;
        --mode)
            MODE="${2:-both}"
            if [[ ! "$MODE" =~ ^(dotnet|js|both)$ ]]; then
                echo "Error: --mode must be 'dotnet', 'js', or 'both'"
                exit 1
            fi
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options] [test-names...]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose         Show detailed error output"
            echo "  --mode <mode>         Runtime mode: dotnet, js, or both (default: both)"
            echo "  -h, --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run all tests in both modes"
            echo "  $0 --mode dotnet      # Run all tests in dotnet mode only"
            echo "  $0 hello-world        # Run specific test in both modes"
            echo "  $0 -v --mode js       # Run all tests in js mode with verbose"
            exit 0
            ;;
        *)
            # Assume it's a test name
            TEST_ARGS+=("$1")
            shift
            ;;
    esac
done

main "${TEST_ARGS[@]}"
