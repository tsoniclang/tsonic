# Limitations

This document captures **current constraints** of Tsonic’s compilation model (TypeScript → C# → NativeAOT).

## Not a JavaScript Runtime

Tsonic targets .NET. Code is meant to compile to native binaries; it is not meant to run under Node.js/browser JS runtimes.

- JavaScript globals like `Date`, `Map`, and `Set` are **not** part of the default globals.
- Prefer .NET APIs (`System.DateTime`, `System.Collections.Generic.Dictionary`, `HashSet`, etc.).
- If you want JavaScript-style APIs, opt in explicitly via `@tsonic/js`:

```typescript
import { Date, Map, Set, console } from "@tsonic/js/index.js";
```

## Module System Constraints

- Local imports must include a file extension (`.js` recommended; `.ts` also accepted).
- Arbitrary `node_modules` runtime imports are not supported. Use:
  - local project files, or
  - CLR bindings packages (`@tsonic/dotnet/...`, tsbindgen-generated packages, etc.).

## Unsupported / Rejected Features

These are rejected by the compiler front-end:

- Dynamic `import()` (use static imports)
- `import.meta`
- `with` statement
- Promise chaining: `.then()`, `.catch()`, `.finally()` (use `async`/`await`)
- `any` and `as any` (use concrete types or `unknown`)

## Semantic Differences vs JavaScript

- Integer division truncates toward zero when using integer types (`int`, `long`, etc.).
- Generator `.throw()` does not inject at the suspended yield point (C# iterator limitation).

## Generics + Nullability

C# cannot represent every TypeScript generic/nullability combination. A common example is `T | null` with an unconstrained `T`.

When you hit these diagnostics, add appropriate constraints (`T extends object`) or use boxing (`object | null`) depending on the intent.
