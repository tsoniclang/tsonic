# Tsonic Test Infrastructure

This directory contains end-to-end test fixtures for the Tsonic compiler, testing the complete pipeline from TypeScript source to NativeAOT executable.

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
│   └── run-all.sh               # Unified test runner
└── README.md
```

## Running Tests

```bash
# Run all tests (unit, golden, E2E dotnet, negative)
./test/scripts/run-all.sh

# Quick mode - unit and golden tests only (skip E2E)
./test/scripts/run-all.sh --quick
```

The unified test runner:

1. Runs `npm test` (unit tests + golden tests across all packages)
2. Runs a vanilla TypeScript typecheck of E2E fixtures (`tsc`) to ensure all fixtures are valid TS
3. Runs E2E dotnet tests (compile and execute each fixture)
4. Runs negative tests (verify expected compilation failures)
5. Prints a summary report with pass/fail counts

## Test Fixtures

Each fixture is a complete Tsonic project with:

- `src/index.ts` - TypeScript source code
- `tsonic.dotnet.json` - Project configuration
- `expected-output.txt` - Expected console output (optional)
- `package.json` - NPM dependencies (optional, for @tsonic packages)

## How It Works

1. **Test Execution**: For each fixture:
   - Installs NPM dependencies if needed
   - Builds the project with `tsonic build`
   - Runs the generated executable
   - Validates output against expected output (if provided)
2. **Reporting**: Shows pass/fail status and summary

## Adding New Tests

1. Create a new directory under `test/fixtures/`
2. Add TypeScript source in `src/index.ts`
3. Create `tsonic.dotnet.json` configuration
4. Optionally add:
   - `expected-output.txt` for output validation
   - `package.json` if using @tsonic packages
   - `e2e.meta.json` with `{"expectFailure": true}` for negative tests

## Negative Tests

Negative tests verify that certain invalid constructs are rejected. They have:

- `e2e.meta.json` with `{"expectFailure": true}`
- The test passes if the build fails (compilation error expected)
