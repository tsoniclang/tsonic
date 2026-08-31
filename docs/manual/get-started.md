# Get started

## Requirements

- Node.js 22 or newer;
- the target-native toolchain: .NET 10 SDK for C#, or a current supported Rust
  toolchain for Rust;
- a project-local installation of `@tsonic/cli` and the selected target pack.

## C# project

Install the host and C# target:

```sh
npm install --save-dev @tsonic/cli @tsonic/target-csharp
```

Create `src/index.ts`:

```ts
import { Console } from "@tsonic/dotnet/System.js";
import type { int } from "@tsonic/csharp/types.js";

export function add(left: int, right: int): int {
  const result = left + right;
  Console.WriteLine(result);
  return result;
}
```

Create `tsonic.json`:

```json
{
  "entryPoint": "index.ts",
  "rootDir": "src",
  "outDir": "out",
  "targets": [
    {
      "id": "csharp",
      "options": {
        "namespace": "Example.Generated",
        "outputType": "Exe"
      }
    }
  ]
}
```

Build the generated project:

```sh
npx tsonic build --project tsonic.json
dotnet run --project out/csharp/TsonicGenerated.csproj
```

Continue with the [C# target manual](targets/csharp/README.md).

## Rust project

Install the host and Rust target:

```sh
npm install --save-dev @tsonic/cli @tsonic/target-rust
```

Create `src/index.ts`:

```ts
import type { int32 } from "@tsonic/core/types.js";

export function add(left: int32, right: int32): int32 {
  return left + right;
}
```

Create `tsonic.json`:

```json
{
  "entryPoint": "index.ts",
  "rootDir": "src",
  "outDir": "out",
  "targets": [
    {
      "id": "rust",
      "options": {
        "crateName": "example_generated",
        "outputType": "lib"
      }
    }
  ]
}
```

Build the generated project:

```sh
npx tsonic build --project tsonic.json
cargo check --manifest-path out/rust/Cargo.toml
```

Continue with the [Rust target manual](targets/rust/README.md).

## Plugin discovery

Tsonic discovers target and capability plugins from the project package's
installed dependencies and development dependencies. A target name in
`tsonic.json` is not sufficient by itself: the corresponding plugin package
must be installed. Capability packages are installed only when their APIs are
used.

For example, this import requires the target-specific Node capability package:

```ts
import { readFileSync } from "node:fs";
```

- C#: install `@tsonic/csharp-nodejs`.
- Rust: install `@tsonic/rust-nodejs`.

Installing Node does not select JavaScript globals. Source profiles and
capabilities are independent choices.
