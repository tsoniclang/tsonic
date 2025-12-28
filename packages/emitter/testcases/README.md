# Golden Test Suite

This directory contains **golden tests** for the Tsonic emitter - tests that verify the exact C# output generated from TypeScript input.

## Directory Structure

```
testcases/
└── common/                       # All tests
    ├── arrays/basic/
    │   ├── ArrayLiteral.ts       # Source file
    │   └── config.yaml           # Test configuration
    └── expected/                 # Expected .cs output
        └── arrays/basic/
            └── ArrayLiteral.cs
```

## Config File Format

Each test directory contains a `config.yaml`:

```yaml
tests:
  - input: ArrayLiteral.ts
    title: should emit array literals correctly

  # For diagnostic tests (no .cs file needed):
  - input: InvalidCode.ts
    title: should emit TSN1234 for invalid input
    expectDiagnostics:
      - TSN1234
```

## Test Categories

- **arrays/**: basic, destructuring, multidimensional, spread
- **async/**: basic (Promise → Task)
- **classes/**: basic, constructor, field-inference, inheritance, static-members
- **control-flow/**: switch
- **edge-cases/**: generic-null-default, nested-scopes, shadowing
- **functions/**: arrow, basic, closures, default-params
- **operators/**: nullish-coalescing, optional-chaining
- **structs/**: basic
- **types/**: anonymous-objects, conditional, constants, dictionaries, generics, interfaces, mapped, tuples-arity, utility-types

## Running Tests

```bash
# Run all emitter tests (including golden tests)
npm run test:emitter

# Run only golden tests
npm run test:emitter -- --grep "Golden Tests"
```

## Updating Expected Files

When the emitter changes, regenerate expected files:

```bash
cd packages/emitter
npx tsx scripts/update-golden-tests.ts
```

## Adding a New Test

1. Create test directory:

   ```bash
   mkdir -p testcases/common/category/subcategory
   ```

2. Add source and config:

   ```
   common/category/subcategory/
   ├── MyTest.ts
   └── config.yaml
   ```

3. Generate expected file:

   ```bash
   npx tsx scripts/update-golden-tests.ts
   ```

   This creates: `common/expected/category/subcategory/MyTest.cs`

## Namespace Calculation

Namespace is derived from the path:

```
common/arrays/basic/ArrayLiteral.ts
    └─ TestCases.common.arrays.basic.ArrayLiteral
```

## See Also

- [Emitter Implementation](../src/emitter.ts)
- [Golden Test Harness](../src/golden.test.ts)
- [Discovery Logic](../src/golden-tests/discovery.ts)
- [Update Script](../scripts/update-golden-tests.ts)
