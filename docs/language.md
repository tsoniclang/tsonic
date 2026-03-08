# Language Guide

Tsonic supports a strict, deterministic subset of TypeScript aimed at CLR and NativeAOT emission.

The practical rule is:

- if Tsonic can recover one stable runtime shape, it compiles
- if multiple runtime interpretations remain, it fails during compilation

## Surfaces and Authoring Style

The active workspace `surface` controls the ambient world.

- `clr` (default): CLR-first ambient APIs
- `@tsonic/js`: JS-style globals and receiver methods

Examples:

```ts
// clr
import { Console } from "@tsonic/dotnet/System.js";
Console.WriteLine("hello");
```

```ts
// @tsonic/js
const s = "  hello  ".trim();
const xs = [1, 2, 3].map((x) => x + 1);
console.log(s, xs.length);
```

Node modules are package-based, not ambient:

```ts
import * as fs from "node:fs";
import * as path from "node:path";
```

## Modules

Supported:

- local relative imports with explicit extensions
- package imports backed by CLR bindings
- installed Tsonic source packages with `tsonic/package-manifest.json`
- deterministic closed-world `import()`
- `import type`

Supported `import()` forms:

```ts
const mod = await import("./module.js");
await import("./side-effect.js");
```

Still rejected:

- non-literal `import(specifier)`
- open-world package dynamic imports
- dynamic imports whose runtime namespace shape is not representable deterministically

Supported `import.meta`:

```ts
const meta = import.meta;
const url = import.meta.url;
const file = import.meta.filename;
const dir = import.meta.dirname;
```

Still rejected:

```ts
const env = import.meta.env;
```

## Functions

Supported:

- function declarations
- arrow functions
- async functions
- higher-order functions
- contextual lambda inference
- generic functions in deterministic contexts

Examples:

```ts
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

const double = (n: number): number => n * 2;

export async function load(): Promise<number> {
  return 42;
}
```

Generic function values work when the callable shape is fixed by usage:

```ts
const id = <T>(x: T): T => x;

const f: (x: number) => number = id;
const value = f(1);
```

Also supported:

```ts
const box: { run: (x: number) => number } = { run: id };
const handlers: Array<(x: number) => number> = [id];
```

Still rejected:

```ts
const id = <T>(x: T): T => x;
const copy = id; // no monomorphic callable shape
```

## Promise / Async Support

Supported:

- `async` / `await`
- Promise constructor
- `Promise.resolve`, `Promise.reject`, `Promise.all`
- `then`, `catch`, `finally` chains

Example:

```ts
async function load(): Promise<number> {
  return 1;
}

export async function main(): Promise<void> {
  const result = await load()
    .then((x) => x + 1)
    .catch(() => 0)
    .finally(() => console.log("done"));

  console.log(result);
}
```

## Classes, Interfaces, Type Aliases

Supported:

- classes
- interfaces
- structural type aliases
- generic classes and interfaces
- inheritance
- interface implementation
- mapped/conditional/utility-type lowering where the compiler can normalize them deterministically

## Objects

Supported:

- ordinary object literals
- simple spreads over finite object shapes
- computed constant keys
- getters/setters
- shorthand methods
- shorthand methods with `this`
- supported `arguments.length` and `arguments[index]` usage inside object-literal methods

Examples:

```ts
const key = "value";

const point = {
  [key]: 21,
  get doubled(): number {
    return this.value * 2;
  },
  scale(factor: number): number {
    return this.value * factor;
  },
};
```

Still rejected:

- open-ended/dynamic object bag cases that need JS runtime object semantics Tsonic cannot prove
- object-literal `super`
- unsupported `arguments` usage patterns that need full JS function-object behavior

## Arrays, Tuples, Collections

Supported:

- native arrays
- tuple lowering
- array spread/destructuring
- JS-surface array methods (`map`, `filter`, `reduce`, `find`, `Array.from`, ...)
- symbol-key dictionaries

Examples:

```ts
const xs = [1, 2, 3];
const ys = xs.filter((x) => x > 1).map((x) => x * 2);

const entry: [string, number] = ["a", 1];
```

## Generators

Supported:

- generators
- async generators
- bidirectional generator protocols
- broad yield lowering in supported expressions/statements

See `generators.md`.

## Numeric Types

Important rule:

- plain TypeScript `number` means Tsonic `double`
- integer CLR types come from `@tsonic/core/types.js`

Example:

```ts
import type { int } from "@tsonic/core/types.js";

const a: number = 1; // double-space
const b: int = 1 as int;
```

See `numeric-types.md`.

## Intrinsics

Supported core intrinsics:

- `stackalloc`
- `sizeof`
- `defaultof`
- `nameof`
- `trycast`
- `asinterface`
- `istype`
- `out` / `ref` / `inref`
- attributes DSL

See `lang-intrinsics.md`.

## Current Explicit Non-Goals

- arbitrary `any`
- open-world JS execution
- generic function values with no monomorphic runtime shape
- unrestricted `import.meta`
- unrestricted dynamic `import()`

See `limitations.md`.
