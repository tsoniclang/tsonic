# Tsonic E2E Test Infrastructure

This directory contains end-to-end test scripts for the Tsonic compiler, testing the complete pipeline from TypeScript source to NativeAOT executable.

## Structure

```
test/
├── fixtures/                    # Test cases
│   ├── hello-world/             # Simple console output test
│   ├── collections/             # BCL collections and LINQ test
│   ├── file-io/                 # BCL file I/O operations test
│   ├── linq-dotnet/             # LINQ operations test
│   └── ...                      # More test fixtures
├── scripts/
│   ├── run-all.sh               # Run all E2E tests
│   ├── run-dotnet.sh            # Run dotnet mode tests
│   ├── run-negative.sh          # Run negative tests (expect failures)
│   └── run-single.sh            # Run a single test fixture
└── README.md
```

## Running Tests

```bash
# Run all E2E tests
./test/scripts/run-all.sh

# Run dotnet mode tests only
./test/scripts/run-dotnet.sh

# Run negative tests (expected failures)
./test/scripts/run-negative.sh
```

## Test Fixtures

Each fixture is a complete Tsonic project with:

- `src/index.ts` - TypeScript source code
- `tsonic.json` or `tsonic.dotnet.json` - Project configuration
- `expected-output.txt` - Expected console output (optional)
- `package.json` - NPM dependencies (optional, for @tsonic/core)

## How It Works

1. **Test Execution**: For each fixture:
   - Installs NPM dependencies if needed
   - Builds the project with `tsonic build`
   - Runs the generated executable
   - Validates output against expected output
2. **Reporting**: Shows pass/fail status and summary

## Adding New Tests

1. Create a new directory under `test/fixtures/`
2. Add TypeScript source in `src/index.ts`
3. Create `tsonic.dotnet.json` configuration
4. Optionally add:
   - `expected-output.txt` for output validation
   - `package.json` if using @tsonic/core
   - `e2e.meta.json` with `{"expectFailure": true}` for negative tests

## Negative Tests

Negative tests verify that certain invalid constructs are rejected. They have:

- `e2e.meta.json` with `{"expectFailure": true}`
- The test passes if the build fails with expected errors
