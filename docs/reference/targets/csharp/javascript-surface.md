# C# JavaScript surface

## Array copies

`Array.from` copies a dense array directly into capacity-sized native
storage. A mapped copy visits the live source length, including changes made by
its callback. It does not run a hidden density scan or widen every element to an
optional boxed value.

```ts
import type { int32 } from "@tsonic/core/types.js";

const values: int32[] = [1, 2];
const doubled = Array.from(values, value => value + value);
```

Ordinary arrays use dense native storage, including open array parameters.
Length construction initializes native defaults rather than holes. Omitted
literal elements and sparse mutations reject. Use explicit `(int32 | undefined)[]`
elements when absence is part of the source contract.

Ordinary strings use .NET UTF-16 units. See [native performance](../../native-performance.md)
for string boundaries, array initialization, ownership and explicit compatibility.

Select with `surfaces: ["js"]`. The target composes the shared JavaScript source
profile and references `@tsonic/csharp-js`.

Implemented families include arrays, strings, maps, sets, dates, JSON with
replacer callbacks and selected `toJSON`, regular expressions, promises,
`Intl`, symbols, weak collections, timers, numeric typed arrays, number/math
operations, and console APIs covered by the selected operation tables and
runtime proofs.

```ts
const expression = /(?<name>[a-z]+)/giu;
const match = expression.exec("Tsonic");
console.log(match?.groups?.name);
```

Regular expressions use complete ECMAScript syntax and state rather than
`System.Text.RegularExpressions` approximation. Exact JavaScript UTF-16 values
use the explicit `JsString` lane; ordinary native strings remain the default.

Open reflection, `eval`, arbitrary dynamic member access, and unsupported
runtime object projection remain rejected.

See the detailed [support inventory](support-inventory.md).

## Number formatting

`Intl.NumberFormat` uses the deterministic `en`/`en-US` locale. Decimal,
percent and currency formatting support fraction or significant precision.
Resolved digit properties are optional: significant precision does not invent
fraction-digit values. Resolved grouping is `false`, `"auto"`, `"always"` or
`"min2"`, not a boolean approximation.

```ts
import type { int64 } from "@tsonic/core/types.js";

export function display(value: int64): string {
  return new Intl.NumberFormat("en", { useGrouping: false }).format(value);
}
```

The integer stays exact, including values beyond `Number.MAX_SAFE_INTEGER`.
`formatToParts` and bigint-backed `toLocaleString` use the same formatter.
Nonstandard notation (including compact), unit options, accounting signs,
nondefault sign display, rounding priorities/modes/increments and trailing-zero
strategies are not implemented by this runtime; selecting them throws at
formatter construction. They are not silently ignored. The shared TypeScript
declarations describe the source API, not universal target support.
