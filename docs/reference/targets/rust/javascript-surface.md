# Rust JavaScript surface

## Array copies

`Array.from` materializes the destination slots directly, preserving source
element identity. A dense copy has no hidden density prepass, temporary
element vector or automatic optional-element widening.

```ts
import type { int32 } from "@tsonic/core/types.js";

const values: int32[] = [1, 2];
const copy = Array.from(values);
```

Ordinary arrays use dense native storage, including open array parameters.
Length construction initializes native defaults rather than holes. Omitted
literal elements and sparse mutations reject. Use explicit `(int32 | undefined)[]`
elements when absence is part of the source contract.

Ordinary strings use UTF-8 byte offsets. See [native performance](../../native-performance.md)
for string boundaries, array initialization, ownership and explicit compatibility.

Select with `surfaces: ["js"]`. The target composes the shared JavaScript
source profile and activates `@tsonic/rust-js` only when selected operations
require it.

Implemented closed families include arrays, strings, maps, sets, dates, JSON
with replacer callbacks and selected `toJSON`, regular expressions, promises,
`Intl`, symbols, weak collections, timers, numeric/math operations, console
APIs, object-shape operations, and numeric typed arrays covered by the
operation inventory and runtime proofs.

```ts
const expression = /(?<name>[a-z]+)/giu;
const match = expression.exec("Tsonic");
console.log(match?.groups?.name);
```

Regular expressions use an ECMAScript engine rather than translating patterns
to Rust regex syntax. Exact UTF-16 behavior uses the explicit `JsString` lane
only where selected; native Rust strings remain the default carrier.

The JS surface does not add an embedded JavaScript engine or open reflection.
Each accepted operation has one static Rust lowering or one closed runtime
contract. Unsupported dynamic behavior rejects.

See the detailed [support inventory](support-inventory.md).

## Number formatting

`Intl.NumberFormat` uses the deterministic `en`/`en-US` locale. Decimal,
percent and currency formatting support fraction or significant precision.
Resolved digit properties are optional: significant precision does not invent
fraction-digit values. Resolved grouping is `false`, `"auto"`, `"always"` or
`"min2"`, not a boolean approximation.

```ts
import type { uint64 } from "@tsonic/core/types.js";

export function display(value: uint64): string {
  return value.toLocaleString("en", { useGrouping: false });
}
```

The integer stays exact, including values beyond `Number.MAX_SAFE_INTEGER`.
`format` and `formatToParts` use the same formatter. Nonstandard notation
(including compact), unit options, accounting signs, nondefault sign
display, rounding priorities/modes/increments and trailing-zero strategies
are not implemented by this runtime; selecting them fails at formatter
construction. They are not silently ignored. The shared TypeScript declarations
describe the source API, not universal target support.
