# Troubleshooting

Common issues and solutions.

## Installation Issues

### "tsonic: command not found"

**Cause**: CLI not installed globally or PATH not set.

**Solutions**:

```bash
# Reinstall globally
npm install -g @tsonic/cli

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
Error: Config file not found: tsonic.json
```

**Solutions**:

1. Run from project root (where `tsonic.json` is)
2. Create config: `tsonic project init`
3. Specify path: `tsonic build --config path/to/tsonic.json`

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

Add `.ts` extension to local imports:

```typescript
// ✅ Correct
import { User } from "./User.ts";

// ❌ Wrong
import { User } from "./User";
```

### "TypeScript compilation failed"

**Solutions**:

1. Check TypeScript errors in output
2. Ensure type packages are installed:
   ```bash
   npm install --save-dev @tsonic/types @tsonic/js-globals
   ```
3. Run emit only to see generated C#:
   ```bash
   tsonic emit src/App.ts --verbose
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
   import { Path, File } from "@tsonic/dotnet/System.IO";
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
function process(data: any): any { ... }

// ✅ Correct
function process(data: unknown): string { ... }
function process<T>(data: T): T { ... }
```

### "Promise.then is not supported"

**Solutions**:

Use async/await instead of promise chaining:

```typescript
// ❌ Wrong
fetch(url).then(r => r.json()).then(data => console.log(data));

// ✅ Correct
const response = await fetch(url);
const data = await response.json();
console.log(data);
```

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
tsonic emit src/App.ts
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
