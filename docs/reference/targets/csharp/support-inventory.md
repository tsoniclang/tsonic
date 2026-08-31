# C# support inventory

This inventory describes the closed families proved by the C# target.
Individual .NET APIs remain governed by their reflected declarations and exact
provider relations.

## TypeScript language families

- ESM modules, source packages, side-effect imports, re-exports, module
  initialization, and default exports;
- functions, classes, interfaces, enums, aliases, constructors, inheritance,
  statics, generics, overload implementations, callbacks, and closures;
- primitives, arrays, rectangular arrays, tuples, fixed arrays, records,
  structural object shapes, nullable values, discriminated unions, and finite
  broad values;
- arithmetic, comparison, bitwise and boolean operators, updates,
  assignments, spreads, optional chains, nullish coalescing, assertions, and
  selected conversions;
- blocks, branches, switch, loops, exceptions, cleanup, async/await,
  synchronous/asynchronous iteration, generators, and resource management;
- mapped and utility types used to produce closed callable and object shapes.

## .NET families

- framework and configured assembly namespaces through
  `@tsonic/dotnet/*`;
- classes, structs, interfaces, enums, delegates, constructors, methods,
  properties, fields, indexers, events, inheritance, and attributes;
- generic type/method families, constraints, nullable metadata, optional and
  default parameters, `params`, by-reference modes, arrays, pointers, function
  pointers, and tasks;
- provider-backed object initializers only when exact field/property relations
  and construction policy exist.

The inventory is metadata-shaped: Tsonic does not maintain a hand-written
allowlist of BCL type names.

### Check one .NET API

Import the exact namespace and let the selected framework/assembly metadata
answer the question:

```ts
import { File } from "@tsonic/dotnet/System.IO.js";

export function read(path: string): string {
  return File.ReadAllText(path);
}
```

If the type, overload, conversion, or assembly relation is unavailable, the
build fails at the import or provider boundary. The documentation therefore
lists supported metadata *families* rather than copying the evolving .NET API
catalog.

## JavaScript families

- arrays, strings, numbers, Math, maps, sets, dates, JSON, RegExp, promises,
  console, timers, selected typed arrays, closed object-shape operations, and
  explicit `JsString` UTF-16 behavior;
- exact overloads and operations supplied by the selected JavaScript source
  profile and C# operation tables;
- no embedded JavaScript engine, open reflection, or best-effort dispatch.

## Node families

- path, URL, filesystem, filesystem promises, process, OS, Buffer, HTTP,
  crypto, zlib, utilities, timers, assertions, and declared stream/sink
  contracts;
- canonical `node:*` imports resolved by `@tsonic/csharp-nodejs` to static C#
  runtime calls;
- binary buffers and HTTP bodies, process state, timing/memory metrics, and
  exact filesystem option objects where declared.

## Explicit target boundaries

- unproved provider identity, conversion, storage, location, safety, or
  metadata shape;
- runtime module cycles whose ESM initialization cannot be preserved;
- open object graphs or dynamic calls that require CLR reflection;
- target-specific generator or pointer combinations outside the approved
  native/runtime protocols.

For exact configuration and rejection rules, see
[configuration](configuration.md) and [limitations](limitations.md).
