# Troubleshooting

Common issues and solutions.

## Installation Issues

### "tsonic: command not found"

**Cause**: CLI not installed globally or PATH not set.

**Solutions**:

```bash
# Reinstall globally
npm install -g tsonic

# Or use npx
npx tsonic --version

# Check npm global path
npm config get prefix
# Add to PATH if needed
```

### ".NET SDK not found"

**Cause**: .NET 10 SDK not installed.

**Solutions**:

```bash
# Check installation
dotnet --version

# Install from https://dotnet.microsoft.com/download/dotnet/10.0

# Linux (Ubuntu/Debian)
sudo apt-get install dotnet-sdk-10.0
```

## Build Errors

### "Config file not found"

```
Error: No tsonic.workspace.json found
```

**Solutions**:

1. Run from inside a workspace (any directory under the workspace root)
2. Initialize a new workspace: `tsonic init`
3. Specify the workspace config path explicitly: `tsonic build --config path/to/tsonic.workspace.json`
4. If the workspace has multiple projects, add `--project <name>`

### "Entry point is required"

```
Error: Entry point is required for executable builds
```

**Solutions**:

1. Provide entry file: `tsonic build src/App.ts`
2. Add to config:
   ```json
   { "entryPoint": "src/App.ts" }
   ```

### "No exported main() function"

```
Error: No exported main() function found
```

**Solutions**:

Ensure your entry file exports `main`:

```typescript
// ✅ Correct
export function main(): void {
  // ...
}

// ❌ Wrong - not exported
function main(): void {
  // ...
}
```

### "Cannot resolve module"

```
Error TSN1001: Cannot resolve module './User'
```

**Solutions**:

Add a file extension to local imports (`.js` is recommended):

```typescript
// ✅ Correct
import { User } from "./User.js";

// ❌ Wrong
import { User } from "./User";
```

### "TypeScript compilation failed"

**Solutions**:

1. Check TypeScript errors in output
2. Ensure type packages are installed:
   ```bash
   npm install --save-dev tsonic @tsonic/core @tsonic/globals
   ```
3. Run generate only to see generated C#:
   ```bash
   tsonic generate src/App.ts --verbose
   ```

### "dotnet publish failed"

**Solutions**:

1. Check .NET SDK version:

   ```bash
   dotnet --version  # Should be 10.x
   ```

2. Try manual build:

   ```bash
   cd generated
   dotnet build
   ```

3. Check for C# compilation errors in output

4. Ensure NuGet packages exist:
   ```bash
   dotnet restore
   ```

## Runtime Errors

### "File not found" at runtime

**Cause**: Working directory different from expected.

**Solutions**:

1. Use absolute paths
2. Use `Path.Combine` for cross-platform paths:
   ```typescript
   import { Path, File } from "@tsonic/dotnet/System.IO.js";
   const path = Path.Combine(".", "data", "file.txt");
   ```

### Null reference exceptions

**Cause**: Accessing property on null value.

**Solutions**:

1. Check for null:

   ```typescript
   if (value !== null) {
     // safe to use
   }
   ```

2. Use optional chaining:
   ```typescript
   const name = user?.profile?.name;
   ```

## Type Issues

### "Type 'any' is not supported"

**Solutions**:

Replace `any` with specific types:

```typescript
// ❌ Wrong
function process(data: any): any {
  return data;
}

// ✅ Correct
function process(data: unknown): string {
  return String(data);
}
function process<T>(data: T): T {
  return data;
}
```

### "Promise.then is not supported"

**Solutions**:

Use async/await instead of promise chaining:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

declare function getData(): Promise<string>;

export async function main(): Promise<void> {
  // ❌ Wrong
  getData().then((data) => {
    Console.WriteLine(data);
  });

  // ✅ Correct
  const data = await getData();
  Console.WriteLine(data);
}
```

### Nullable Generics

```
Error TSN7415: Nullable union 'T | null' with unconstrained generic type
parameter 'T' cannot be represented in C#.
```

**Cause**: C# cannot represent nullable unconstrained generics properly for value types.

**Why this happens**:

In C#, `T?` behaves differently based on constraints:

- `where T : struct` → `T?` becomes `Nullable<T>` (works)
- `where T : class` → `T?` becomes nullable reference (works)
- No constraint → `T?` is just `T` for value types (broken!)

**Solutions**:

1. **Use `object | null`** to box the value:

```typescript
// ❌ Error
function getValue<T>(value: T | null): T {
  return value ?? getDefault();
}

// ✅ Works - uses boxing
function getValue<T>(value: object | null): T {
  return (value ?? getDefault()) as T;
}
```

2. **Add a reference type constraint**:

```typescript
// ✅ Works - T is always a reference type
function getValue<T extends object>(value: T | null): T {
  return value ?? getDefault();
}
```

3. **Add a value type constraint**:

```typescript
// ✅ Works - T is always a value type
function getValue<T extends struct>(value: T | null): T {
  return value ?? getDefault();
}
```

4. **Avoid nullable generic parameters** when possible:

```typescript
// ✅ Works - nullable handling at call site
function getValue<T>(value: T, fallback: T): T {
  return value ?? fallback;
}

// Caller handles nullable
const result = item !== null ? getValue(item, defaultItem) : defaultItem;
```

> **See also:** [Diagnostics TSN7415](diagnostics.md#tsn7415-nullable-union-with-unconstrained-generic)

## Performance Issues

### Large binary size

**Solutions**:

1. Enable trimming:

   ```json
   { "output": { "trimmed": true } }
   ```

2. Optimize for size:

   ```json
   { "optimize": "size" }
   ```

3. Strip symbols:
   ```json
   { "output": { "stripSymbols": true } }
   ```

### Slow compilation

**Solutions**:

1. Use incremental builds (don't clean every time)
2. Reduce number of source files
3. Simplify generic usage

## Debugging

### View generated C#

```bash
tsonic generate src/App.ts
cat generated/src/App.cs
```

### Verbose output

```bash
tsonic build src/App.ts --verbose
```

### Keep build artifacts

```bash
tsonic build src/App.ts --keep-temp
```

### Manual .NET build

```bash
cd generated
dotnet build --verbosity detailed
```

### Include debug symbols

```bash
tsonic build src/App.ts --no-strip
```

## Getting Help

- **Documentation**: [docs/](.)
- **GitHub Issues**: https://github.com/tsoniclang/tsonic/issues
- **Source Code**: https://github.com/tsoniclang/tsonic
