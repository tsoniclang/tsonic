#!/bin/bash
# E2E Test Runner for Tsonic
# Tests the complete pipeline: TypeScript → IR → C# → NativeAOT executable

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
BCL_TYPES_DIR="../tsbindgen/.tests/validate"

# Variables
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
VERBOSE=${VERBOSE:-0}

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

    # Check if BCL types exist
    if [ ! -d "$BCL_TYPES_DIR" ]; then
        log_warning "BCL types not found at $BCL_TYPES_DIR"
        log_info "Generating BCL types with tsbindgen..."
        (cd ../tsbindgen && node scripts/validate.js)
        if [ ! -d "$BCL_TYPES_DIR" ]; then
            log_error "Failed to generate BCL types"
            exit 1
        fi
    fi
    log_success "BCL types found at $BCL_TYPES_DIR"
}

# Clean test output directory
clean_output() {
    log_info "Cleaning test output directory..."
    rm -rf "$TESTS_OUTPUT_DIR"
    mkdir -p "$TESTS_OUTPUT_DIR"
}

# Run a single test fixture
run_test() {
    local fixture_name=$1
    local fixture_path="$FIXTURES_DIR/$fixture_name"
    local output_dir="$TESTS_OUTPUT_DIR/$fixture_name"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ ! -d "$fixture_path" ]; then
        log_error "Fixture not found: $fixture_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi

    echo ""
    echo "----------------------------------------"
    echo "Testing: $fixture_name"
    echo "----------------------------------------"

    # Create output directory
    mkdir -p "$output_dir"

    # Copy fixture to output directory
    cp -r "$fixture_path"/* "$output_dir/"

    # Run the test using helper script
    if "$HELPERS_DIR/run-single-test.sh" "$fixture_name" "$output_dir" "$BCL_TYPES_DIR"; then
        log_success "Test passed: $fixture_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "Test failed: $fixture_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ "$VERBOSE" -eq 1 ]; then
            echo "--- Error details ---"
            tail -20 "$output_dir/test.log" 2>/dev/null || echo "No log file found"
            echo "---"
        fi
        return 1
    fi
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
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=1
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options] [test-names...]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Show detailed error output"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run all tests"
            echo "  $0 hello-world        # Run specific test"
            echo "  $0 -v hello-world     # Run with verbose output"
            exit 0
            ;;
        *)
            # Assume it's a test name
            break
            ;;
    esac
done

main "$@"