# Troubleshooting Guide

Common issues and solutions when using Tsonic.

## Installation Issues

### "dotnet not found"

**Problem:** Tsonic requires .NET SDK 8.0 or later.

**Solution:**

```bash
# Check .NET installation
dotnet --version

# If not installed, download from:
# https://dotnet.microsoft.com/download
```

---

### "tsonic: command not found"

**Problem:** Tsonic CLI not installed or not in PATH.

**Solution:**

```bash
# Install globally
npm install -g @tsonic/cli

# Or use npx
npx @tsonic/cli build src/main.ts
```

---

## Compilation Errors

### Import Errors

**Problem:** "TSN1001: Missing .ts extension"

**Solution:** All local imports must have `.ts`:

```typescript
// ❌ Wrong
import { User } from "./models/User";

// ✅ Correct
import { User } from "./models/User.ts";
```

---

### Case Sensitivity

**Problem:** "TSN1003: Case mismatch"

**Solution:** Import paths must match file case exactly:

```typescript
// File: User.ts (capital U)
import { User } from "./user.ts"; // ❌ Wrong

import { User } from "./User.ts"; // ✅ Correct
```

---

### Circular Dependencies

**Problem:** "TSN1006: Circular dependency detected"

**Solution:** Refactor to break the cycle:

```typescript
// Before:
// A.ts imports B.ts
// B.ts imports A.ts  // ❌ Circular!

// After: Extract shared code
// A.ts imports Shared.ts
// B.ts imports Shared.ts  // ✅ No cycle
```

---

## Build Issues

### NativeAOT Build Fails

**Problem:** `dotnet publish` fails with NativeAOT errors.

**Check:**

1. .NET SDK version is 8.0+
2. NativeAOT workload installed:
   ```bash
   dotnet workload install wasm-tools
   ```
3. Valid RID for your platform

---

### "Assembly not found"

**Problem:** Missing .NET assembly reference.

**Solution:** Check that required NuGet packages are in `tsonic.json`:

```json
{
  "dotnet": {
    "packages": {
      "Newtonsoft.Json": "13.0.3"
    }
  }
}
```

---

## Runtime Errors

### "Method not found" at Runtime

**Problem:** Using a .NET method that was trimmed by NativeAOT.

**Solution:** Add to `tsonic.json`:

```json
{
  "dotnet": {
    "trimming": "partial"
  }
}
```

---

### Type Conversion Errors

**Problem:** Mismatched types between TypeScript and C#.

**Common issues:**

- TypeScript arrays → `List<T>` (not `T[]`)
- C# arrays → `ReadonlyArray<T>` in TypeScript

**Solution:** Check [type mappings](language/type-mappings.md) guide.

---

## Performance Issues

### Slow Compilation

**Problem:** Compilation takes too long.

**Solutions:**

1. Use incremental builds (coming soon)
2. Reduce project size
3. Check for circular dependencies

---

### Large Output Binary

**Problem:** Executable is too large.

**Solutions:**

1. Enable trimming:
   ```json
   {
     "dotnet": {
       "trimming": "full"
     }
   }
   ```
2. Use shared runtime instead of self-contained
3. Remove unused .NET packages

---

## Language Feature Issues

### Feature Not Supported

**Problem:** "TSN3xxx: Feature not supported"

**Common unsupported features:**

- Default exports
- CommonJS modules
- Dynamic imports
- Decorators
- Namespaces (use ESM modules)

**Solution:** Use supported alternatives. See [diagnostics guide](diagnostics.md).

---

## Getting More Help

If your issue isn't covered here:

1. **Check diagnostics** - See [error codes](diagnostics.md)
2. **Search issues** - [GitHub Issues](https://github.com/tsoniclang/tsonic/issues)
3. **Ask community** - Discord/Discussions
4. **File a bug** - Include:
   - Tsonic version (`tsonic --version`)
   - .NET version (`dotnet --version`)
   - Minimal reproduction
   - Full error message

---

**See Also:**

- [Diagnostic Codes](diagnostics.md) - All error codes
- [Getting Started](getting-started.md) - Setup guide
- [Language Reference](language/module-system.md) - Language features
