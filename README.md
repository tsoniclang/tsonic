# Tsonic

Tsonic is a TypeScript to C# compiler that produces native executables via .NET NativeAOT. Write TypeScript, get fast native binaries.

## Why Tsonic?

Tsonic lets TypeScript/JavaScript developers build fast native apps on .NET:

- **Native binaries** (no JS runtime).
- **.NET standard library**: use the .NET runtime + BCL (files, networking, crypto, concurrency, etc.).
- **Node-style APIs when you want them**: optional compatibility packages like `@tsonic/nodejs` and `@tsonic/js`.
- **Still TypeScript**: your code still typechecks with `tsc`. Tsonic also adds CLR-style numeric types like `int`, `uint`, `long`, etc. via `@tsonic/core/types.js`.
- **Better security**: you build on a widely used runtime and standard library with regular updates.

Tsonic targets the .NET BCL (not Node’s built-in modules). If you want Node-like APIs, install `@tsonic/nodejs`.

## Why C# + NativeAOT?

Tsonic compiles TypeScript to C#, then uses the standard CLR NativeAOT pipeline (`dotnet publish`) to produce native binaries.

TypeScript maps well to C#/.NET:

- **Classes, interfaces, generics**: translate naturally to CLR types.
- **Async/await**: TS `async` maps cleanly to `Task`/`ValueTask`.
- **Iterators and generators**: map to C# iterator patterns.
- **Delegates/callbacks**: map to `Action`/`Func` without inventing a new runtime ABI.

NativeAOT produces **single-file, self-contained native executables**.

Details live in the docs: `docs/build-output.md` and `docs/architecture/pipeline.md`.

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
- .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0
- macOS only: Xcode Command Line Tools (`xcode-select --install`)
  - Sanity check: `xcrun --show-sdk-path`

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

### Using .NET APIs (BCL)

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

## Examples

### LINQ extension methods (`where`, `select`)

```ts
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqList<T> = Linq<List<T>>;

const xs = new List<number>() as unknown as LinqList<number>;
xs.add(1);
xs.add(2);
xs.add(3);

const doubled = xs.where((x) => x % 2 === 0).select((x) => x * 2).toList();
void doubled;
```

### JSON with the .NET BCL (`System.Text.Json`)

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";

type User = { id: number; name: string };

const user: User = { id: 1, name: "Alice" };
const json = JsonSerializer.serialize(user);
Console.writeLine(json);

const parsed = JsonSerializer.deserialize<User>(json);
if (parsed !== undefined) {
  Console.writeLine(parsed.name);
}
```

### Optional JS-style APIs (via `@tsonic/js`)

```ts
import { console, JSON } from "@tsonic/js";

const value = JSON.parse<{ x: number }>("{\"x\": 1}");
console.log(JSON.stringify(value));
```

### Minimal ASP.NET Core API

First, add the shared framework + bindings:

```bash
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
```

Then write:

```ts
import { WebApplication } from "@tsonic/aspnetcore/Microsoft.AspNetCore.Builder.js";

export function main(): void {
  const builder = WebApplication.createBuilder([]);
  const app = builder.build();

  app.mapGet("/", () => "Hello from Tsonic + ASP.NET Core!");
  app.run();
}
```

## tsbindgen (CLR Bindings Generator)

Tsonic doesn’t “guess” CLR types from strings. It relies on **bindings packages** generated by **tsbindgen**:

- Given a `.dll` (or a directory of assemblies), tsbindgen produces:
  - ESM namespace facades (`*.js`) + TypeScript types (`*.d.ts`)
  - `bindings.json` (namespace → CLR mapping)
  - `internal/metadata.json` (CLR metadata for resolution)
- Tsonic uses these artifacts to resolve imports like:
  - `import { Console } from "@tsonic/dotnet/System.js"`

Tsonic can run tsbindgen for you:

```bash
# Add a local DLL (auto-generates bindings if you omit the types package)
tsonic add package ./path/to/MyLib.dll

# Add a NuGet package (auto-generates bindings for the full transitive closure)
tsonic add nuget Newtonsoft.Json 13.0.3

# Or use published bindings packages (no auto-generation)
tsonic add nuget Microsoft.EntityFrameworkCore 10.0.1 @tsonic/efcore
```

## CLI Commands

| Command                | Description             |
| ---------------------- | ----------------------- |
| `tsonic project init`  | Initialize new project  |
| `tsonic generate [entry]` | Generate C# code only |
| `tsonic build [entry]` | Build native executable |
| `tsonic run [entry]`   | Build and run           |
| `tsonic add package <dll> [types]` | Add a local DLL + bindings |
| `tsonic add nuget <id> <ver> [types]` | Add a NuGet package + bindings |
| `tsonic add framework <ref> [types]` | Add a FrameworkReference + bindings |
| `tsonic restore`        | Restore deps + bindings   |
| `tsonic pack`          | Create a NuGet package  |

### Common Options

| Option                   | Description                          |
| ------------------------ | ------------------------------------ |
| `-c, --config <file>`    | Config file (default: tsonic.json)   |
| `-o, --out <name>`       | Output name (binary/assembly)        |
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

## Naming Modes

Tsonic supports two binding/name styles:

- Default: JavaScript-style member names (`Console.writeLine`)
- `--pure`: CLR-style member names (`Console.WriteLine`)

```bash
tsonic project init --pure
```

## Npm Workspaces (Multi-Assembly Repos)

Tsonic projects are plain npm packages, so you can use **npm workspaces** to build multi-assembly repos (e.g. `@acme/domain` + `@acme/api`).

- Each workspace package has its own `tsonic.json` and produces its own output (`dist/` for libraries, `out/` for executables).
- Build workspace dependencies first (via `npm run -w <pkg> ...`) before building dependents.
- For library packages, you can generate **tsbindgen** CLR bindings under `dist/` and expose them via npm `exports`; Tsonic resolves imports using Node resolution (including `exports`) and locates the nearest `bindings.json`.

See `docs/dotnet-interop.md` for the recommended `dist/` + `exports` layout.

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
