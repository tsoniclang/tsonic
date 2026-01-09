# Tsonic

Tsonic is a TypeScript to C# compiler that produces native executables via .NET NativeAOT. Write TypeScript, get fast native binaries.

## Key Features

- **TypeScript to Native**: Compile TypeScript directly to native executables
- **Direct .NET Access**: Full access to .NET BCL with native performance
- **NativeAOT Compilation**: Single-file, self-contained executables
- **Full .NET Interop**: Import and use any .NET library
- **ESM Module System**: Standard ES modules with `.js` import specifiers
- **Optional JSRuntime**: Use JavaScript-style APIs via `@tsonic/js`

## Installation

```bash
npm install -g tsonic
```

**Prerequisites:**

- Node.js 22+
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
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  const message = "Hello from Tsonic!";
  Console.writeLine(message);

  const numbers = [1, 2, 3, 4, 5];
  Console.writeLine(`Numbers: ${numbers.length}`);
}
```

### Using .NET APIs

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { File } from "@tsonic/dotnet/System.IO.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

export function main(): void {
  // File I/O
  const content = File.readAllText("./README.md");
  Console.writeLine(content);

  // .NET collections
  const list = new List<number>();
  list.add(1);
  list.add(2);
  list.add(3);
  Console.writeLine(`Count: ${list.count}`);
}
```

## CLI Commands

| Command                | Description             |
| ---------------------- | ----------------------- |
| `tsonic project init`  | Initialize new project  |
| `tsonic generate <entry>` | Generate C# code only |
| `tsonic build <entry>` | Build native executable |
| `tsonic run <entry>`   | Build and run           |
| `tsonic add package <dll> [types]` | Add a local DLL + bindings |
| `tsonic add nuget <id> <ver> [types]` | Add a NuGet package + bindings |
| `tsonic add framework <ref> [types]` | Add a FrameworkReference + bindings |
| `tsonic pack`          | Create a NuGet package  |

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
  "entryPoint": "src/App.ts"
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

| Package           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `@tsonic/globals` | Base types (Array, String, iterators, Promise) |
| `@tsonic/core`    | Core types (int, float, etc.)                  |
| `@tsonic/dotnet`  | .NET BCL type declarations                     |

## License

MIT
