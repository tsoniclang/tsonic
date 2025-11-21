# Getting Started with Tsonic

This guide will help you install Tsonic and compile your first TypeScript program to a native executable.

## Prerequisites

Before you begin, make sure you have:

1. **.NET SDK 8.0 or later**

   ```bash
   dotnet --version  # Should show 8.0 or higher
   ```

   If not installed, download from [dot.net](https://dot.net)

2. **Node.js 18.0 or later**

   ```bash
   node --version  # Should show v18.0 or higher
   ```

   If not installed, download from [nodejs.org](https://nodejs.org)

## Installation

Install Tsonic globally via npm:

```bash
npm install -g @tsonic/cli
```

Verify the installation:

```bash
tsonic --version
```

## Your First Program

Let's create a simple "Hello World" program.

### Step 1: Create a TypeScript File

Create a file named `hello.ts`:

```typescript
// hello.ts
export function main(): void {
  console.log("Hello from Tsonic!");
  console.log("TypeScript → C# → NativeAOT");
}
```

**Important**: The entry file must export a `main()` function that serves as the program's entry point.

### Step 2: Compile and Run

Compile and run in one command:

```bash
tsonic run hello.ts
```

You should see:

```
Hello from Tsonic!
TypeScript → C# → NativeAOT
```

### Step 3: Build an Executable

To create a standalone executable:

```bash
tsonic build hello.ts --out hello
```

This creates a native executable named `hello` (or `hello.exe` on Windows). Run it:

```bash
./hello  # Linux/macOS
hello    # Windows
```

The executable:

- Is a single file with no dependencies
- Starts instantly (no JIT compilation)
- Is typically 10-50 MB depending on features used

## A More Realistic Example

Let's build a simple file processor that uses .NET libraries.

Create `processor.ts`:

```typescript
import { File, Directory } from "System.IO";

export function main(): void {
  const dir = "data";

  // Create directory if it doesn't exist
  if (!Directory.Exists(dir)) {
    Directory.CreateDirectory(dir);
    console.log(`Created directory: ${dir}`);
  }

  // Write a file
  const content = "Tsonic is awesome!";
  const filePath = `${dir}/message.txt`;
  File.WriteAllText(filePath, content);
  console.log(`Wrote: ${filePath}`);

  // Read it back
  const readContent = File.ReadAllText(filePath);
  console.log(`Read: ${readContent}`);

  // Count files in directory
  const files = Directory.GetFiles(dir);
  console.log(`Files in ${dir}: ${files.length}`);
}
```

Build and run:

```bash
tsonic run processor.ts
```

Output:

```
Created directory: data
Wrote: data/message.txt
Read: Tsonic is awesome!
Files in data: 1
```

## Project Structure

For larger projects, organize your code into modules:

```
my-app/
├── tsonic.json          # Configuration
├── src/
│   ├── main.ts          # Entry point
│   ├── models/
│   │   └── User.ts
│   └── services/
│       └── DataService.ts
└── README.md
```

### tsonic.json

Create a configuration file to customize build settings:

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/main.ts",
  "sourceRoot": "src",
  "outputDirectory": "dist",
  "outputName": "myapp"
}
```

Now you can just run:

```bash
tsonic build
```

It will use the config file automatically.

## Common Commands

### Development

```bash
# Run immediately without saving executable
tsonic run src/main.ts

# Check generated C# code
tsonic emit src/main.ts --out generated/

# Watch for changes and rebuild (future feature)
tsonic watch src/
```

### Building

```bash
# Build for current platform
tsonic build src/main.ts

# Build for specific platform
tsonic build src/main.ts --rid linux-x64 --out myapp-linux

# Optimize for size
tsonic build src/main.ts --optimize size

# Keep debug symbols
tsonic build src/main.ts --no-strip
```

### Debugging

```bash
# See what's happening
tsonic build src/main.ts --verbose

# Keep temporary build files
tsonic build src/main.ts --keep-temp

# Check diagnostics in JSON format
tsonic build src/main.ts --diagnostics json
```

## Module System Basics

Tsonic uses ES Modules with a few important rules:

### Local Imports

**Always include `.ts` extension** for local files:

```typescript
// ✅ Correct
import { User } from "./models/User.ts";
import { helper } from "../utils/helper.ts";

// ❌ Wrong - Missing extension
import { User } from "./models/User";
```

### .NET Imports

**No extension** for .NET namespaces:

```typescript
// ✅ Correct
import { File } from "System.IO";
import { HttpClient } from "System.Net.Http";

// ❌ Wrong - Extension on .NET import
import { File } from "System.IO.ts";
```

See [Module System](./language/module-system.md) for complete rules.

## Understanding Namespaces

Your directory structure becomes C# namespaces automatically:

```
src/models/User.ts       → MyApp.models.User
src/services/api.ts      → MyApp.services.api
src/utils/string/fmt.ts  → MyApp.utils.string.fmt
```

The root namespace comes from `tsonic.json` (`rootNamespace` field).

See [Namespaces](./language/namespaces.md) for details.

## Type System Basics

TypeScript types map to native .NET types:

```typescript
// Primitives
const name: string = "Alice"; // → string
const age: number = 25; // → double
const active: boolean = true; // → bool

// Arrays
const nums: number[] = [1, 2, 3]; // → List<double>

// Async
async function fetch(): Promise<string> {
  // ...
}
// → async Task<string> fetch()

// Optional
function greet(name?: string): void {
  // ...
}
// → void greet(string? name = null)
```

See [Type Mappings](./language/type-mappings.md) for complete reference.

## Common Errors

### TSN1001: Missing .ts Extension

```
ERROR TSN1001: Local import missing .ts extension
  import { User } from "./User";
                        ^^^^^^^^
```

**Fix**: Add `.ts` extension:

```typescript
import { User } from "./User.ts";
```

### TSN5001: .NET SDK Not Found

```
ERROR TSN5001: .NET SDK not found
```

**Fix**: Install .NET SDK from [dot.net](https://dot.net)

### TSN1020: No Entry Point

```
ERROR TSN1020: Entry file has top-level code but no main() export
```

**Fix**: Export a `main()` function:

```typescript
export function main(): void {
  // Your code here
}
```

See [Diagnostics](./diagnostics.md) for all error codes.

## Next Steps

Now that you have Tsonic installed and working:

1. **Learn the CLI** - See [CLI Reference](./cli.md) for all commands and options
2. **Explore Examples** - Check out [Examples](./examples/index.md) for working code
3. **Use .NET Libraries** - Read [.NET Interop](./language/dotnet-interop.md) to leverage the ecosystem
4. **Build Something** - Start with a simple CLI tool or HTTP service

## Getting Help

- **Documentation**: You're reading it! Browse the [full docs](./index.md)
- **Examples**: See [working examples](./examples/index.md)
- **Troubleshooting**: Check [common issues](./troubleshooting.md)
- **Community**: Ask on GitHub Discussions

Happy coding with Tsonic!
