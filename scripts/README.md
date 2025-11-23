# Tsonic E2E Test Infrastructure

This directory contains end-to-end test scripts for the Tsonic compiler, testing the complete pipeline from TypeScript source to NativeAOT executable.

## Structure

```
scripts/
├── e2e-test.sh                 # Main test runner
├── harness/
│   ├── fixtures/                # Test cases
│   │   ├── hello-world/         # Simple console output test
│   │   ├── file-io/             # BCL file I/O operations test
│   │   └── collections/         # BCL collections and LINQ test
│   └── helpers/
│       └── run-single-test.sh   # Helper script to run individual tests
```

## Running Tests

```bash
# Run all tests
./scripts/e2e-test.sh

# Run specific test
./scripts/e2e-test.sh hello-world

# Run with verbose output
./scripts/e2e-test.sh -v hello-world

# Run multiple specific tests
./scripts/e2e-test.sh hello-world file-io
```

## Test Fixtures

Each fixture is a complete Tsonic project with:
- `src/index.ts` - TypeScript source code
- `tsonic.json` - Project configuration
- `*.csproj` - .NET project file (preserved during build)
- `expected-output.txt` - Expected console output (optional)
- `package.json` - NPM dependencies (optional, for @types/dotnet)
- `test.sh` - Additional test script (optional)

## How It Works

1. **Prerequisites Check**: Ensures Tsonic CLI, dotnet SDK, and BCL types are available
2. **Test Execution**: For each fixture:
   - Copies fixture to temporary test directory
   - Installs NPM dependencies if needed
   - Builds the project with `tsonic build`
   - Runs the generated executable
   - Validates output against expected output
   - Runs additional test scripts if present
3. **Reporting**: Shows pass/fail status and summary

## Adding New Tests

1. Create a new directory under `scripts/harness/fixtures/`
2. Add TypeScript source in `src/index.ts`
3. Create `tsonic.json` configuration
4. Add a `.csproj` file with necessary settings
5. Optionally add:
   - `expected-output.txt` for output validation
   - `package.json` if using @types/dotnet
   - `test.sh` for additional validation

## BCL Type Dependencies

Tests that use .NET BCL types require:
1. Generated types from tsbindgen (at `../tsbindgen/.tests/validate/`)
2. `@types/dotnet` package declaration in package.json
3. `dotnet.libraries` configuration in tsonic.json

## Current Test Status

### Working Tests
- ✅ hello-world - Basic console output without BCL imports

### Tests In Progress
- ⚠️ file-io - Requires Tsonic.Runtime implementation
- ⚠️ collections - Requires Tsonic.Runtime implementation

## Known Issues

1. **Tsonic.Runtime Missing**: The runtime library needed for JavaScript semantics is not yet implemented
2. **BCL Type Resolution**: Path resolution for BCL types needs improvement for test scenarios

## Future Improvements

- Add more test fixtures covering:
  - Async/await operations
  - Complex type mappings
  - Module imports/exports
  - Error handling
- Implement parallel test execution
- Add performance benchmarking
- Create CI/CD integration