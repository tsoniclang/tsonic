# Applications and libraries

Tsonic can generate an executable application or a library. The target decides
the exact native shape.

| Target | Application | Library |
| --- | --- | --- |
| C# | `outputType: "Exe"` | `outputType: "Library"` |
| Rust | `outputType: "bin"` | `outputType: "lib"` |

## C# applications

A C# executable runs the TypeScript entry module. Put startup work at top
level, or call your own function from top level:

```ts
import { Console } from "@tsonic/dotnet/System.js";

export function run(): void {
  Console.WriteLine("Hello from C#");
}

run();
```

Tsonic generates `TsonicEntrypoint.Main`, initializes imported modules in ESM
order, and executes the entry module. An exported function named `main` is an
ordinary function; C# does not call it by name.

Top-level `await` produces an asynchronous generated `Main` when the selected
runtime contract supports it.

## Rust applications

A generated Rust binary requires the entry module to export `main` with a unit
result:

```ts
export function main(): void {
  const values = [1, 2, 3];
  if (values.length !== 3) {
    throw new Error("invalid length");
  }
}
```

Tsonic generates native Rust `main`, performs required module initialization,
then calls the exported function. An async entry may return `Promise<void>`.
Fallible and asynchronous entry contracts are lowered only when analysis
proves the complete native path.

## Libraries

Libraries export declarations instead of owning a process entrypoint:

```ts
import type { int32 } from "@tsonic/core/types.js";

export interface Point {
  x: int32;
  y: int32;
}

export function distanceSquared(point: Point): int32 {
  return point.x * point.x + point.y * point.y;
}
```

The target emits public native declarations for supported exports. Native
consumers reference the generated assembly or crate through the normal native
project system.

Avoid top-level side effects in reusable libraries. C# can preserve synchronous
entry-module initialization with a CLR module initializer, but an asynchronous
library initializer is rejected. Rust preserves only module initialization
that its closed initialization plan can represent.

## Share code between C# and Rust

Put portable behavior in a source package:

```ts
// packages/core/src/index.ts
export function greeting(name: string): string {
  return `Hello, ${name}!`;
}
```

Use a C# entry module:

```ts
import { Console } from "@tsonic/dotnet/System.js";
import { greeting } from "@acme/core/index.js";

Console.WriteLine(greeting("C#"));
```

Use a Rust entry module:

```ts
import { greeting } from "@acme/core/index.js";

export function main(): void {
  if (greeting("Rust") !== "Hello, Rust!") {
    throw new Error("unexpected greeting");
  }
}
```

Each application gets its own `tsonic.json`. Both consume the same source
package. This keeps target entry rules out of shared code.

## Generated or user-owned project

Use a generated project for a normal console application or library. Use a
user-owned project when the native project itself is part of the product:

- ASP.NET Core, desktop, test, or custom-SDK C# projects;
- Rust workspaces with direct crate dependencies;
- cross compilation, WebAssembly, embedded, kernel, or bare-metal Rust;
- custom signing, linker, build-script, packaging, or deployment policy.

The target-specific project guides contain complete examples:

- [C# projects](targets/csharp/projects-and-output.md)
- [Rust projects](targets/rust/projects-and-output.md)
