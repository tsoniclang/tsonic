# Quickstart Guide

**Goal**: Get your first Tsonic program running in 5 minutes

**Prerequisites**:

- Node.js 18+ installed
- .NET 8.0 SDK installed

---

## 1. Install Tsonic

```bash
# Clone the repository (until npm package available)
git clone https://github.com/tsoniclang/tsonic.git
cd tsonic

# Install dependencies and build
npm install
./scripts/build.sh

# Link CLI globally
npm link packages/cli
```

Verify installation:

```bash
tsonic --version
```

---

## 2. Create Your First Program

Create a new directory for your project:

```bash
mkdir hello-tsonic
cd hello-tsonic
```

Create `main.ts`:

```typescript
// main.ts
export function main(): void {
  console.log("Hello from Tsonic!");
}
```

**Important**:

- Entry point MUST export a `main()` function
- File MUST be named `main.ts` at project root

---

## 3. Build Your Program

```bash
tsonic build main.ts
```

This will:

1. Parse your TypeScript code
2. Generate C# code in `.tsonic/generated/`
3. Compile to native executable with NativeAOT
4. Output executable: `./bin/main` (or `main.exe` on Windows)

**Expected output**:

```
[tsonic] Parsing TypeScript...
[tsonic] Generating C#...
[tsonic] Compiling with NativeAOT...
[tsonic] ✓ Built successfully: ./bin/main
```

---

## 4. Run Your Program

```bash
./bin/main
```

**Output**:

```
Hello from Tsonic!
```

**Windows**:

```bash
.\bin\main.exe
```

---

## 5. What Just Happened?

Your TypeScript code was transformed through these steps:

**TypeScript** → **IR** → **C#** → **Native Executable**

```typescript
// Your TypeScript
export function main(): void {
  console.log("Hello from Tsonic!");
}
```

↓ Compiled to C#

```csharp
namespace MyProgram
{
    public static class main
    {
        public static void main()
        {
            Tsonic.Runtime.Console.log("Hello from Tsonic!");
        }
    }
}
```

↓ Compiled to native code

```
Native executable with exact JavaScript semantics
```

---

## 6. Quick Examples

### Using Variables

```typescript
// main.ts
export function main(): void {
  const name = "World";
  const greeting = `Hello, ${name}!`;
  console.log(greeting);
}
```

### Using Arrays

```typescript
// main.ts
export function main(): void {
  const numbers = [1, 2, 3, 4, 5];
  const doubled = numbers.map((n) => n * 2);
  console.log(doubled); // [2, 4, 6, 8, 10]
}
```

### Using .NET Libraries

```typescript
// main.ts
import { File } from "System.IO";
import { Path } from "System.IO";

export function main(): void {
  const content = "Hello from Tsonic!";
  const path = Path.Combine(".", "output.txt");
  File.WriteAllText(path, content);
  console.log(`Wrote to ${path}`);
}
```

**Note**: .NET imports do NOT have `.ts` extension (they're not TypeScript files)

---

## 7. Project Structure

A typical Tsonic project:

```
my-project/
├── main.ts              # Entry point (required)
├── src/
│   ├── utils/
│   │   └── helpers.ts
│   └── models/
│       └── User.ts
├── .tsonic/             # Generated (gitignored)
│   ├── generated/       # C# code
│   └── bin/             # Build artifacts
├── bin/                 # Output executables
│   └── main
└── tsconfig.json        # TypeScript configuration
```

---

## 8. Module System Rules

**Critical**: Tsonic requires **ESM with `.ts` extensions** for local imports:

```typescript
// ✅ CORRECT - Local import with .ts extension
import { User } from "./models/User.ts";

// ✅ CORRECT - .NET import without extension
import { File } from "System.IO";

// ❌ WRONG - Missing .ts for local import
import { User } from "./models/User"; // ERROR TSN1001

// ❌ WRONG - .ts extension on .NET import
import { File } from "System.IO.ts"; // Makes no sense
```

**Why?**: This is part of the ESM standard. It ensures imports are explicit and unambiguous.

---

## 9. Common Issues

### "Cannot find module" Error

**Problem**:

```
ERROR TSN1001: Cannot resolve module './User'
```

**Solution**: Add `.ts` extension:

```typescript
// Change this:
import { User } from "./User";

// To this:
import { User } from "./User.ts";
```

### "No main() function found" Error

**Problem**:

```
ERROR TSN5001: No exported main() function found in main.ts
```

**Solution**: Ensure your entry point exports `main()`:

```typescript
// Add this to main.ts:
export function main(): void {
  // Your code here
}
```

### NativeAOT Build Fails

**Problem**:

```
ERROR TSN5003: NativeAOT compilation failed
```

**Solution**: Ensure .NET 8.0 SDK is installed:

```bash
dotnet --version  # Should show 8.0.x
```

---

## 10. Next Steps

Now that you have a working program, learn more:

1. **[Language Basics](02-language-basics.md)** - TypeScript → C# fundamentals
2. **[Using .NET Libraries](03-using-dotnet.md)** - File I/O, HTTP, JSON
3. **[Building Applications](04-building-apps.md)** - Real project patterns
4. **[Deployment](05-deployment.md)** - Shipping executables

---

## Quick Reference

| Task          | Command                |
| ------------- | ---------------------- |
| Build program | `tsonic build main.ts` |
| Run program   | `./bin/main`           |
| Check version | `tsonic --version`     |
| Get help      | `tsonic --help`        |
| Clean build   | `rm -rf .tsonic bin`   |

---

## Getting Help

- **Documentation**: See [Reference Docs](../reference/)
- **Examples**: See [Examples](../examples/)
- **Issues**: Report at https://github.com/tsoniclang/tsonic/issues

---

**Next**: [Language Basics →](02-language-basics.md)
