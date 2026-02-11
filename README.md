# Tsonic

Tsonic is a TypeScript to C# compiler that produces native executables via .NET NativeAOT. Write TypeScript, get fast native binaries. Opt into `@tsonic/js` (JavaScript runtime APIs) and `@tsonic/nodejs` (Node-style APIs) when you want them.

## Why Tsonic?

Tsonic lets TypeScript/JavaScript developers build fast native binaries for x64 and ARM64:

- **Native binaries** (no JS runtime).
- **.NET standard library**: use the .NET runtime + BCL (files, networking, crypto, concurrency, etc.).
- **Optional JS/Node APIs when you want them**: `@tsonic/js` (JavaScript runtime APIs) and `@tsonic/nodejs` (Node-style APIs).
- **Still TypeScript**: your code still typechecks with `tsc`. Tsonic also adds CLR-style numeric types like `int`, `uint`, `long`, etc. via `@tsonic/core/types.js`.
- **Better security**: you build on a widely used runtime and standard library with regular updates.

Tsonic targets the .NET BCL (not Node’s built-in modules). If you want JavaScript-style APIs, opt into `@tsonic/js`. If you want Node-like APIs, opt into `@tsonic/nodejs`.

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
- **Optional JS/Node compatibility**: `@tsonic/js` (JS runtime APIs) and `@tsonic/nodejs` (Node-style APIs)
- **Direct .NET Access**: Full access to .NET BCL with native performance
- **NativeAOT Compilation**: Single-file, self-contained executables
- **Full .NET Interop**: Import and use any .NET library
- **ESM Module System**: Standard ES modules with `.js` import specifiers

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

# Basic workspace + default project
tsonic init

# Or: include JavaScript runtime APIs (console, JSON, timers, etc.)
tsonic init --js

# Or: include Node-style APIs (fs, path, crypto, http, etc.)
tsonic init --nodejs
```

This creates:

- `tsonic.workspace.json` - Workspace config (dependencies live here)
- `libs/` - Workspace-scoped DLLs
- `packages/my-app/tsonic.json` - Project config
- `packages/my-app/src/App.ts` - Entry point
- `package.json` - NPM workspaces + scripts

### Build and Run

```bash
npm run build    # Build native executable
./packages/my-app/out/my-app  # Run it

# Or build and run in one step
npm run dev
```

### Example Program

```typescript
// packages/my-app/src/App.ts
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  const message = "Hello from Tsonic!";
  Console.WriteLine(message);

  const numbers = [1, 2, 3, 4, 5];
  Console.WriteLine(`Numbers: ${numbers.length}`);
}
```

### Using .NET APIs (BCL)

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { File } from "@tsonic/dotnet/System.IO.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

export function main(): void {
  // File I/O
  const content = File.ReadAllText("./README.md");
  Console.WriteLine(content);

  // .NET collections
  const list = new List<number>();
  list.Add(1);
  list.Add(2);
  list.Add(3);
  Console.WriteLine(`Count: ${list.Count}`);
}
```

## Examples

### LINQ extension methods (`Where`, `Select`)

```ts
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqList<T> = Linq<List<T>>;

const xs = new List<number>() as unknown as LinqList<number>;
xs.Add(1);
xs.Add(2);
xs.Add(3);

const doubled = xs.Where((x) => x % 2 === 0).Select((x) => x * 2).ToList();
void doubled;
```

### JSON with the .NET BCL (`System.Text.Json`)

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";

type User = { id: number; name: string };

const user: User = { id: 1, name: "Alice" };
const json = JsonSerializer.Serialize(user);
Console.WriteLine(json);

const parsed = JsonSerializer.Deserialize<User>(json);
if (parsed !== undefined) {
  Console.WriteLine(parsed.name);
}
```

### JavaScript runtime APIs (`@tsonic/js`)

First, enable JSRuntime APIs:

```bash
# New project
tsonic init --js

# Existing project
tsonic add js
```

Then write:

```ts
import { console, JSON } from "@tsonic/js/index.js";

export function main(): void {
  const value = JSON.parse<{ x: number }>('{"x": 1}');
  console.log(JSON.stringify(value));
}
```

### Node-style APIs (`@tsonic/nodejs`)

First, enable Node-style APIs:

```bash
# New project
tsonic init --nodejs

# Existing project
tsonic add nodejs
```

Then write:

```ts
import { console, path } from "@tsonic/nodejs/index.js";

export function main(): void {
  console.log(path.join("a", "b", "c"));
}
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
  const builder = WebApplication.CreateBuilder([]);
  const app = builder.Build();

  app.MapGet("/", () => "Hello from Tsonic + ASP.NET Core!");
  app.Run();
}
```

## tsbindgen (CLR Bindings Generator)

Tsonic doesn’t “guess” CLR types from strings. It relies on **bindings packages** generated by **tsbindgen**:

- Given a `.dll` (or a directory of assemblies), tsbindgen produces:
  - ESM namespace facades (`*.js`) + TypeScript types (`*.d.ts`)
  - `bindings.json` (namespace → CLR mapping, plus optional flattened named exports)
  - `internal/index.d.ts` (full type declarations)
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
| `tsonic init`          | Initialize workspace + default project |
| `tsonic generate [entry]` | Generate C# code only |
| `tsonic build [entry]` | Build native executable |
| `tsonic run [entry]`   | Build and run           |
| `tsonic add js`        | Add `@tsonic/js` + JSRuntime DLLs |
| `tsonic add nodejs`    | Add `@tsonic/nodejs` + NodeJS DLLs |
| `tsonic add package <dll> [types]` | Add a local DLL + bindings |
| `tsonic add nuget <id> <ver> [types]` | Add a NuGet package + bindings |
| `tsonic add framework <ref> [types]` | Add a FrameworkReference + bindings |
| `tsonic restore`        | Restore deps + bindings   |
| `tsonic pack`          | Create a NuGet package  |

### Common Options

| Option                   | Description                          |
| ------------------------ | ------------------------------------ |
| `-c, --config <file>`    | Workspace config path (default: auto-detect `tsonic.workspace.json`) |
| `-o, --out <name>`       | Output name (binary/assembly)        |
| `-r, --rid <rid>`        | Runtime identifier (e.g., linux-x64) |
| `-O, --optimize <level>` | Optimization: size or speed          |
| `-k, --keep-temp`        | Keep build artifacts                 |
| `-V, --verbose`          | Verbose output                       |
| `-q, --quiet`            | Suppress output                      |

## Configuration

Tsonic uses **two** config files:

- `tsonic.workspace.json` (workspace root) — shared settings and **all external dependencies**
- `packages/<project>/tsonic.json` — per-project compilation settings

See `docs/configuration.md` for the full reference.

## Workspace Structure

```
my-app/
├── tsonic.workspace.json
├── libs/
├── packages/
│   └── my-app/
│       ├── tsonic.json
│       └── src/App.ts
└── package.json         # npm workspaces + scripts
```

## Npm Workspaces (Multi-Assembly Repos)

Tsonic workspaces are plain npm workspaces, so you can build multi-assembly repos (e.g. `@acme/domain` + `@acme/api`).

- Each workspace package has its own `packages/<name>/tsonic.json` and produces its own output (`dist/` for libraries, `out/` for executables).
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
| `@tsonic/js`      | JavaScript runtime APIs (JS semantics on .NET) |
| `@tsonic/nodejs`  | Node-style APIs implemented in .NET            |

## License

MIT
