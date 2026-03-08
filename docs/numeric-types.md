# Numeric Types

Tsonic treats numeric intent explicitly.

## Core Rule

- TypeScript `number` means Tsonic `double`
- CLR integer/decimal types come from `@tsonic/core/types.js`

Examples:

```ts
const a: number = 1; // double-space
```

```ts
import type { int, long, float, decimal } from "@tsonic/core/types.js";

const i: int = 1 as int;
const l: long = 1 as long;
const f: float = 1 as float;
const d: decimal = 1 as decimal;
```

## Supported Numeric Types

From `@tsonic/core/types.js`:

- signed integers: `sbyte`, `short`, `int`, `long`, `nint`, `int128`
- unsigned integers: `byte`, `ushort`, `uint`, `ulong`, `nuint`, `uint128`
- floating/decimal: `half`, `float`, `double`, `decimal`
- non-numeric primitives: `bool`, `char`

## Why This Exists

TypeScript itself cannot distinguish:

- `int`
- `long`
- `double`

They all erase to `number` at TS type-check time. Tsonic’s proof passes enforce the real CLR semantics later.

## Integer Space vs Double Space

This stays in integer space:

```ts
import type { int } from "@tsonic/core/types.js";

function increment(x: int): int {
  return x + 1;
}
```

This stays in double space:

```ts
function increment(x: number): number {
  return x + 1;
}
```

## Narrowing

Tsonic rejects unprovable narrows.

Rejected examples:

```ts
import type { int } from "@tsonic/core/types.js";

const parsed = parseInt(text, 10);
const value = parsed as int; // rejected unless proven
```

```ts
import type { int } from "@tsonic/core/types.js";

if (typeof value === "number" && Number.isFinite(value)) {
  const x = value as int; // still rejected: finite double is not proven int
}
```

Reason:

- `parseInt(...)` on JS surface returns `number`
- `Number.isFinite(...)` proves finite double, not 32-bit integer

## When Integer Proof Is Accepted

Tsonic accepts narrows when the proof is deterministic.

Examples:

```ts
import type { int } from "@tsonic/core/types.js";

const zero: int = 0 as int;
const value: int = (flag ? 1 : 2) as int;
```

Branch-sensitive numeric proof also works for deterministic `int` branch results.

## JS Surface Interop

On `@tsonic/js`:

- `length`, array indexes, tuple indexes, and similar index-like values are modeled as integer-space values
- plain JS arithmetic on `number` remains double-space

Example:

```ts
const xs = [1, 2, 3];
const len = xs.length; // int-like
const first = xs[0];
const sum = first + 1; // still depends on element type, not on length/index rules
```

## Guidance

- use `number` when you mean JS-style floating numeric semantics
- use `int` / `long` / `decimal` when CLR precision and range matter
- do not rely on C# compile failures to sort numeric intent out later; Tsonic is expected to reject unproven narrows itself
