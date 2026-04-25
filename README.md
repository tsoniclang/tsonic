# Tsonic

Tsonic compiles a strict, deterministic subset of TypeScript into C#, then into native binaries or .NET libraries.

The current V1 model is:

- one compiler-owned noLib core
- one active ambient surface per workspace
- explicit package-based CLR and module interop
- strict-AOT rejection for anything that cannot be lowered deterministically

## Why Tsonic

- TypeScript authoring with explicit numeric/value semantics when needed
- NativeAOT and regular .NET outputs from the same compiler
- Direct CLR interop through `@tsonic/dotnet` and generated bindings
- JS-surface authoring through `@tsonic/js`
- Node module support through `@tsonic/nodejs`
- First-party source-package consumption for Tsonic-authored npm packages

## Surfaces

Tsonic separates the language prelude from the ambient runtime personality.

- compiler core: always-on noLib baseline (`Promise`, iterators, utility types, array shape)
- `clr` surface: default ambient CLR-first world
- `@tsonic/js` surface: JS-style globals and receiver methods
- `@tsonic/nodejs`: normal package, not a surface

That means:

- CLR workspace:
  - `"abc"` exposes CLR-shaped ambient members
  - import CLR APIs explicitly from `@tsonic/dotnet/...`
- JS workspace:
  - `"abc".trim()`, `[1, 2, 3].map(...)`, `console.log(...)`, `JSON`, `Date` work as ambient JS APIs
- Node usage:
  - keep JS surface active
  - add `@tsonic/nodejs`
  - import `node:*` modules normally

## Installation

```bash
npm install -g tsonic
```

Requirements:

- Node.js 22+
- .NET 10 SDK

## Working From Source

For compiler development, use a sibling checkout layout. The compiler repo is
expected to live beside the runtime and first-party package repos:

```text
~/repos/tsoniclang/
  tsonic/
  runtime/
  core/
  dotnet/
  globals/
  js/
  nodejs/
  aspnetcore/
  efcore/
  efcore-sqlite/
  microsoft-extensions/
```

The `../runtime` dependency is intentional for this repo: tests and package
preflight copy `Tsonic.Runtime.dll` from the sibling runtime build. Most source
and binding package resolution paths use siblings only when they are present
and proven by a `package.json`; otherwise they use installed npm packages. The
full compiler gate also includes source-package graph tests that intentionally
require the authored `../js` and `../nodejs` source-package repos, because
published binding packages do not contain the source-package manifests or
transitive TypeScript source files those tests are proving.

```bash
cd ~/repos/tsoniclang/runtime
dotnet build -c Release

cd ../tsonic
npm ci
npm run build
./test/scripts/run-all.sh
```

`npm run build` is a non-mutating compiler build. Use `npm run format` or
`npm run format:check` explicitly for formatting.

## Quick Start

### Default CLR workspace

```bash
mkdir hello-clr
cd hello-clr
tsonic init
tsonic run
```

Generated sample:

```ts
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  Console.WriteLine("Hello from Tsonic!");
}
```

### JS workspace

```bash
mkdir hello-js
cd hello-js
tsonic init --surface @tsonic/js
tsonic run
```

Generated sample:

```ts
export function main(): void {
  const message = "  Hello from Tsonic JS surface!  ".trim();
  console.log(message);
}
```

### JS + Node modules

```bash
mkdir hello-node
cd hello-node
tsonic init --surface @tsonic/js
tsonic add npm @tsonic/nodejs
```

Then author normal Node-style imports:

```ts
import * as path from "node:path";
import * as fs from "node:fs";

export function main(): void {
  const file = path.join("src", "App.ts");
  console.log(file, fs.existsSync(file));
}
```

Run it:

```bash
tsonic run
```

## Core Imports

Use `@tsonic/core/types.js` for CLR-specific numeric/value intent:

```ts
import type { int, long, bool } from "@tsonic/core/types.js";
```

Use `@tsonic/core/lang.js` for language intrinsics:

```ts
import {
  defaultof,
  nameof,
  sizeof,
  stackalloc,
  out,
} from "@tsonic/core/lang.js";
```

## CLR Interop

Import CLR APIs explicitly:

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

export function main(): void {
  const xs = [1, 2, 3];
  const filtered = Enumerable.Where(xs, (x: number): boolean => x > 1);
  Console.WriteLine(filtered.Count().ToString());
}
```

For external CLR dependencies:

```bash
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic add package ./libs/MyCompany.MyLib.dll
tsonic restore
```

## First-Party Source Packages

`tsonic init` now creates npm-publish-ready source packages by default. Each project gets a source manifest at:

```text
packages/<project>/tsonic.package.json
```

Example:

```json
{
  "schemaVersion": 1,
  "kind": "tsonic-source-package",
  "surfaces": ["@tsonic/js"],
  "source": {
    "exports": {
      ".": "./src/App.ts",
      "./index.js": "./src/App.ts"
    }
  }
}
```

Installed source packages with that manifest are compiled transitively as part of the same Tsonic program.

## Build Modes

```bash
tsonic generate
tsonic build
tsonic run
tsonic test
tsonic pack
```

Supported output shapes include:

- NativeAOT executable
- managed executable
- managed library
- NativeAOT shared/static library

## Current V1 Highlights

- AST-only emitter pipeline
- canonical type identity keys for type comparison, overload matching, and
  runtime-union decisions
- source-package graphs compiled transitively with source-backed metadata
  retained through call, constructor, and narrowing paths
- runtime union carriers that preserve union arm identity instead of lowering
  ambiguous values through `object`
- Promise constructor + `then` / `catch` / `finally` lowering
- deterministic closed-world `import()` support
- supported `import.meta` subset: `url`, `filename`, `dirname`, and bare `import.meta`
- broader object-literal support:
  - accessors
  - computed constant keys
  - shorthand methods
  - supported `arguments.length` / `arguments[index]` cases
- `nameof(...)` and `sizeof<T>()`
- deterministic generic function values in supported monomorphic contexts

## Documentation

- User guide: `docs/README.md`
- Site: `https://tsonic.org/tsonic/`
- Architecture: `docs/architecture/README.md`

## License

MIT
