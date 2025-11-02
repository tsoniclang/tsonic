# Golden Test Suite

This directory contains **golden tests** for the Tsonic emitter - tests that verify the exact C# output generated from TypeScript input.

## Structure

Each test case is a directory containing three files:

```
testcases/
  category/          # e.g., arrays, async, functions
    subcategory/     # e.g., basic, advanced
      title.txt      # One-line test description
      FileName.ts    # TypeScript input (name becomes C# class name)
      expected.cs    # Expected C# output
```

**Important**: The `.ts` filename determines the generated C# class name. For example:

- `Basic.ts` → `class Basic`
- `UserService.ts` → `class UserService`

## How It Works

1. **Auto-discovery**: The test harness (`golden.test.ts`) automatically discovers all test cases
2. **Nested describes**: Test cases are organized into nested `describe` blocks matching the directory structure
3. **Full pipeline**: Each test runs the complete TypeScript → IR → C# pipeline
4. **Exact comparison**: Generated C# is compared character-by-character with expected output

## Adding a New Test

1. **Create a directory** under the appropriate category:

   ```bash
   mkdir -p testcases/arrays/destructuring
   ```

2. **Add three files**:

   **`title.txt`** - Single line description:

   ```
   should emit array destructuring assignment
   ```

   **`ArrayDestructure.ts`** - TypeScript input:

   ```typescript
   export function destructure(arr: number[]): number {
     const [first, second] = arr;
     return first + second;
   }
   ```

   **`expected.cs`** - Expected C# output (without header):

   ```csharp
   using Tsonic.Runtime;

   namespace TestCases.Arrays
   {
       public static class ArrayDestructure
       {
           public static double destructure(Tsonic.Runtime.Array<double> arr)
               {
               var first = arr[0];
               var second = arr[1];
               return first + second;
               }
       }
   }
   ```

   **Note**: Do NOT include the file header (`// Generated from:...`) in expected files. The test harness automatically generates and prepends the header using a shared constant from `constants.ts`. This ensures tests don't break when the header format changes.

3. **Run tests**:
   ```bash
   npm run test:emitter
   ```

## Tips

### Getting the Expected Output

The easiest way to create `expected.cs` is to:

1. Create the `.ts` file with your input
2. Create a temporary `expected.cs` with placeholder content
3. Run the tests - they will fail and show you the actual output
4. Copy the actual output to `expected.cs`
5. **Remove the header** (the first 4 lines starting with `// Generated from:`)

Or use the CLI to generate it:

```bash
cd packages/emitter/testcases/arrays/destructuring
tsonic emit ArrayDestructure.ts --out-dir temp
# Remove header lines before saving
tail -n +5 temp/ArrayDestructure.cs > expected.cs
```

### File Path Normalization

The harness normalizes:

- Line endings (`\r\n` → `\n`)
- Trailing whitespace
- Timestamps (`Generated at: ...` → `TIMESTAMP`)

This makes tests resilient to minor formatting changes.

### Namespace Calculation

The namespace is derived from the directory path:

```
testcases/arrays/basic/Basic.ts
    └─ TestCases.Arrays (namespace)
                 └─ Basic (class name from filename)

testcases/async/advanced/PromiseHelper.ts
    └─ TestCases.Async.Advanced
                       └─ PromiseHelper
```

## Test Organization

Organize tests by feature category:

- **`arrays/`** - Array operations, destructuring, spread
- **`async/`** - Async/await, promises, generators
- **`functions/`** - Function declarations, arrow functions, closures
- **`classes/`** - Class declarations, methods, inheritance
- **`types/`** - Type mappings, unions, generics
- **`interop/`** - .NET interop, imports
- **`edge-cases/`** - Corner cases, error conditions

Within each category, use subdirectories for complexity:

- `basic/` - Simple, fundamental cases
- `advanced/` - Complex scenarios
- `edge-cases/` - Unusual inputs

## Running Tests

```bash
# Run all emitter tests (including golden tests)
npm run test:emitter

# Run only golden tests (via mocha grep)
npm run test:emitter -- --grep "Golden Tests"

# Run specific category
npm run test:emitter -- --grep "Golden Tests arrays"
```

## Troubleshooting

### Test fails with "No .ts input file found"

Make sure your test directory contains exactly one `.ts` file (other than `title.txt`).

### Test fails with "Incomplete test case"

You're missing one of the required files:

- `title.txt`
- `*.ts`
- `expected.cs`

### Test fails with diff showing wrong class name

The C# class name comes from the `.ts` filename, not the directory name.

Example:

- ❌ `input.ts` → `class input`
- ✅ `ArrayHelper.ts` → `class ArrayHelper`

### Test fails with diff showing wrong namespace

Check the directory structure. Namespace is built from path components:

```
testcases/foo/bar/Test.ts → TestCases.Foo (not TestCases.Foo.Bar)
```

The last directory component becomes the class name prefix, not part of the namespace.

## Benefits

✅ **Easy to add** - Just create 3 files
✅ **Exact verification** - Catches any output changes
✅ **Auto-discovered** - No manual test registration
✅ **Well-organized** - Nested describes match directory structure
✅ **Fast feedback** - Clear diffs when tests fail
✅ **Comprehensive** - Tests full TS → IR → C# pipeline

## Contribution Guidelines

When adding golden tests:

1. **Be specific** - One test per feature/behavior
2. **Use descriptive names** - File and title should be clear
3. **Keep it simple** - Focus on one aspect per test
4. **Add comments** - Explain non-obvious behavior in the `.ts` file
5. **Verify output** - Ensure expected.cs is actually correct

## See Also

- [Emitter Implementation](../src/emitter.ts)
- [Golden Test Harness](../src/golden.test.ts)
- [Tsonic Spec](../../../spec/)
