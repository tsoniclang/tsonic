# C# source profile and native APIs

Without `surfaces: ["js"]`, the C# target uses its native source profile.

## C# primitive aliases

```ts
import type {
  bool,
  byte,
  int,
  long,
  double,
} from "@tsonic/csharp/types.js";

export function widen(value: int): long {
  return value as long;
}
```

The aliases use familiar C# names while retaining exact source primitive
facts. Neutral libraries may instead use `int32`, `int64`, and `float64` from
`@tsonic/core/types.js`.

## C# marker aliases

```ts
import { Int32 } from "@tsonic/dotnet/System.js";
import { defaultof, out } from "@tsonic/csharp/lang.js";
import type { int } from "@tsonic/csharp/types.js";

export function parse(): int {
  let output = defaultof<int>();
  return Int32.TryParse("42", out(output)) ? output : defaultof<int>();
}
```

`out`, `ref`, `inref`, and `defaultof` are C# spellings for neutral semantic
contracts. The selected provider signature proves that the second argument of
`TryParse` is write-only; the target does not infer that from the `out`
spelling alone. `ptr` and `fnptr` request native C# pointer and
function-pointer types; they are not aliases for the safe neutral `Pointer<T>`
location.

## .NET virtual imports

A namespace maps to a virtual module:

```ts
import { DateTime, TimeSpan } from "@tsonic/dotnet/System.js";
import { Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";
```

The built-in provider resolves framework references and configured assemblies,
loads only the requested declaration closure, and preserves exact type family,
arity, member, signature, by-reference, generic constraint, nullability, and
attribute information. A missing or unsupported native declaration fails at
the import/provider boundary.

## JavaScript surface

Select the JS source profile explicitly:

```json
{
  "targets": [{ "id": "csharp", "surfaces": ["js"] }]
}
```

```ts
const values = [1, 2, 3];
console.log(values.map((value) => value * 2).join(","));
```

This changes the active ambient source profile and adds the C# JS runtime. It
does not disable explicit `@tsonic/dotnet/*` provider imports.

See the exact [source-module reference](../../../reference/targets/csharp/source-modules.md)
and [.NET provider reference](../../../reference/targets/csharp/native-apis.md).
