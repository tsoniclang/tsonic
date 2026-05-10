---
title: Numeric Types
---

# Numeric Types

Use `@tsonic/core/types.js` when CLR numeric intent matters.

## Examples

```ts
import type { int, long, double, bool } from "@tsonic/core/types.js";
```

Common numeric intent types include:

- `byte`
- `sbyte`
- `short`
- `ushort`
- `int`
- `uint`
- `long`
- `ulong`
- `float`
- `double`
- `decimal`
- `bool`
- `char`

## Why not just `number`

`number` still exists, but it is not enough for every CLR-facing case.

You should use explicit numeric types when:

- overload resolution depends on numeric width or signedness
- emitted CLR APIs require exact types
- precision or storage intent should be explicit

Examples:

```ts
import type { int } from "@tsonic/core/types.js";

const count: int = 1 as int;
```

```ts
import type { byte } from "@tsonic/core/types.js";

const bytes = new Uint8Array([1 as byte, 2 as byte]);
```

## Practical guidance

- use plain `number` for ordinary JS-surface arithmetic
- use branded numeric types when CLR APIs, storage shape, or overload selection
  depend on the exact numeric kind
- annotate public boundaries and sensitive overload calls first; you usually do
  not need to brand every local intermediate expression

## Rule

Tsonic prefers explicit numeric intent over permissive conversion.

`typeof value === "number"` narrows `unknown` or union values to TypeScript
`number`. It does not prove any CLR integral width.

```ts
import type { int } from "@tsonic/core/types.js";

export function readInt(value: unknown): int {
  if (typeof value === "number") {
    return value; // error: number is not proven int
  }
  return 0;
}
```

Use a Tsonic numeric proof when a CLR integral type is required.

```ts
import type { int } from "@tsonic/core/types.js";

export function readInt(value: number): int {
  if (
    Number.isInteger(value) &&
    value >= -2147483648 &&
    value <= 2147483647
  ) {
    return value as int;
  }
  return 0;
}
```
