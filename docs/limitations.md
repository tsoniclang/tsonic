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

## EF Core + NativeAOT (Experimental)

EF Core’s NativeAOT support relies on **query precompilation**, which performs static analysis of your source code and generates C# **interceptors**. This is an EF Core feature (not Tsonic-specific) and is still experimental.

- **Dynamic queries are not supported** by EF query precompilation. Avoid composing a query across multiple statements (e.g. `let q = ...; if (...) q = q.Where(...);`).
- Interceptors are **invalidated by any source change**. Treat precompilation as part of a publish/CI pipeline, not an inner-loop workflow.
- Some runtime operations are not supported under NativeAOT (e.g. `EnsureCreated()`); prefer **migrations** / migration bundles.

If you are publishing a Tsonic + EF Core app with NativeAOT, you generally need to run EF’s optimizer against the generated C# project (or use EF’s MSBuild integration):

```bash
# 1) Generate C# (and the .csproj)
tsonic build

# 2) Run EF optimization in the generated project directory
dotnet ef dbcontext optimize --precompile-queries --nativeaot \
  --project tsonic.csproj \
  --output-dir ef-compiled-model \
  --context AppDbContext
```

When using `--nativeaot`, EF generates C# interceptor source under the namespace `Microsoft.EntityFrameworkCore.GeneratedInterceptors`. The C# compiler requires an explicit MSBuild opt-in:

- Add `dotnet.msbuildProperties.InterceptorsNamespaces` in `tsonic.workspace.json`, or
- Provide your own `.csproj` at the project root and include `<InterceptorsNamespaces>...`.

See EF Core docs for the current limitations and recommended rewrites.
