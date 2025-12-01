# Tsonic

Tsonic is a TypeScript to C# compiler that produces native executables via .NET NativeAOT. Write TypeScript, get fast native binaries.

## Key Features

- **TypeScript to Native**: Compile TypeScript directly to native executables
- **Two Runtime Modes**:
  - `js` mode: JavaScript semantics via Tsonic.JSRuntime
  - `dotnet` mode: Direct .NET BCL access with C# semantics
- **NativeAOT Compilation**: Single-file, self-contained executables
- **Full .NET Interop**: Import and use any .NET library
- **ESM Module System**: Standard ES modules with `.ts` extensions

## Installation

```bash
npm install -g @tsonic/cli
```

**Prerequisites:**

- Node.js 18+
- .NET 10 SDK

## Quick Start

### Initialize a New Project

```bash
mkdir my-app && cd my-app
tsonic project init
```

This creates:

- `src/App.ts` - Entry point
- `tsonic.json` - Configuration
- `package.json` - With build scripts

### Build and Run

```bash
npm run build    # Build native executable
./out/app        # Run it

# Or build and run in one step
npm run dev
```

### Example Program

```typescript
// src/App.ts
export function main(): void {
  const message = "Hello from Tsonic!";
  console.log(message);

  const numbers = [1, 2, 3, 4, 5];
  const doubled = numbers.map((n) => n * 2);
  console.log("Doubled:", doubled.join(", "));
}
```

## Runtime Modes

### JS Mode (Default)

Uses Tsonic.JSRuntime for JavaScript-compatible semantics:

```typescript
// Arrays behave like JavaScript
const arr: number[] = [];
arr[10] = 42;
console.log(arr.length); // 11 (sparse array)
```

### Dotnet Mode

Direct .NET BCL access with C# semantics:

```bash
tsonic project init --runtime dotnet
```

```typescript
import { Console } from "@tsonic/dotnet/System";
import { File } from "@tsonic/dotnet/System.IO";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

export function main(): void {
  // Use .NET APIs directly
  const content = File.ReadAllText("./README.md");
  Console.WriteLine(content);

  // .NET collections
  const list = new List<number>();
  list.Add(1);
  list.Add(2);
  Console.WriteLine(`Count: ${list.Count}`);
}
```

## CLI Commands

| Command                | Description             |
| ---------------------- | ----------------------- |
| `tsonic project init`  | Initialize new project  |
| `tsonic emit <entry>`  | Generate C# code only   |
| `tsonic build <entry>` | Build native executable |
| `tsonic run <entry>`   | Build and run           |

### Common Options

| Option                   | Description                          |
| ------------------------ | ------------------------------------ |
| `-c, --config <file>`    | Config file (default: tsonic.json)   |
| `-o, --out <path>`       | Output path                          |
| `-r, --rid <rid>`        | Runtime identifier (e.g., linux-x64) |
| `-O, --optimize <level>` | Optimization: size or speed          |
| `-k, --keep-temp`        | Keep build artifacts                 |
| `-V, --verbose`          | Verbose output                       |
| `-q, --quiet`            | Suppress output                      |

## Configuration (tsonic.json)

```json
{
  "$schema": "https://tsonic.dev/schema/v1.json",
  "rootNamespace": "MyApp",
  "entryPoint": "src/App.ts",
  "sourceRoot": "src",
  "outputDirectory": "generated",
  "outputName": "app",
  "runtime": "js",
  "optimize": "speed",
  "buildOptions": {
    "stripSymbols": true,
    "invariantGlobalization": true
  }
}
```

## Project Structure

```
my-app/
├── src/
│   └── App.ts           # Entry point (exports main())
├── tsonic.json          # Configuration
├── package.json         # NPM package
├── generated/           # Generated C# (gitignored)
└── out/                 # Output executable (gitignored)
```

## Documentation

- **[User Guide](docs/README.md)** - Complete user documentation
- **[Architecture](docs/architecture/README.md)** - Technical details

## Type Packages

| Package                  | Description                   |
| ------------------------ | ----------------------------- |
| `@tsonic/types`          | Core types (int, float, etc.) |
| `@tsonic/js-globals`     | JS mode ambient types         |
| `@tsonic/dotnet-globals` | Dotnet mode ambient types     |
| `@tsonic/dotnet`         | .NET BCL type declarations    |

## License

MIT
