---
title: Type System
---

# Type System Rules

Tsonic is intentionally strict.

## Core rule

If a construct cannot be lowered deterministically, it is rejected.

That applies to:

- unsupported dynamic behavior
- unresolved `any`-like escapes
- unsupported open-ended runtime typing paths
- ambiguous lowering cases

## What “strict” means here

Strictness is not just about TypeScript flags. In Tsonic it also means:

- no silent runtime bridge for unsupported shapes
- no best-effort lowering when overload selection is ambiguous
- no hidden weakening of types to make emission “just work”

## Numeric intent

Use `@tsonic/core/types.js` for CLR-specific numeric/value intent:

```ts
import type { int, long, bool, double } from "@tsonic/core/types.js";
```

`number` is still available, but explicit CLR numeric types are important when
precision and overload selection matter.

Typical cases where explicit numeric intent matters:

- CLR overload selection
- interop with `Span<T>` and other typed CLR APIs
- APIs that distinguish `int`, `long`, `byte`, and floating-point values

Numeric adaptation is contextual. A TypeScript integer literal can still lower
to the CLR carrier required by the expected type.

Example:

```ts
type ParsedRange = { type: string; from: number; to: number };

export function range(size: number): number | ParsedRange {
  if (size < 0) return -2;
  return { type: "bytes", from: 0, to: size };
}
```

The `-2` literal is syntactically an integer, but the union arm is TypeScript
`number`, whose CLR carrier is `double`. The emitter must therefore select the
numeric union arm and emit the equivalent of:

```cs
return Union<double, ParsedRange>.From1(-2);
```

It must not treat the value literal as compatible with the object arm, and it
must not leave the value unwrapped when the method returns a runtime union.

## Canonical type identity

Compiler type comparison is identity-based, not raw display-string based.

Bad comparison shape:

```text
System.Span`1
global::System.Span<int>
```

Those strings are different spellings of the same CLR generic type shape. The
compiler canonicalizes identity before comparing assignability, overload
equivalence, structural membership, and runtime-union arms.

Source example:

```ts
export function copy(numbers: int[], destination: int[]): void {
  const source = new Span<int>(numbers);
  const target = new Span<int>(destination);
  source.CopyTo(target);
}
```

Correct lowering keeps the `Span<int>` value direct:

```cs
source.CopyTo(target);
```

It must not insert an `(object)` bridge just because metadata and emitted C#
spelled the generic type differently. Ref-like CLR types such as `Span<T>`
cannot be boxed, so string-based identity comparison is a correctness bug.

## Runtime union carriers

Runtime unions preserve their carrier family until a deterministic projection is
required.

Example:

```ts
type Ok<T> = { success: true; value: T };
type Err<E> = { success: false; error: E };
type Result<T, E> = Ok<T> | Err<E>;

export function keepError(
  result: Result<boolean, string>
): Result<boolean, string> {
  if (!result.success) {
    return result;
  }

  return { success: true, value: true };
}
```

After the guard, the local value is narrowed to the `Err<string>` arm. Returning
that arm from a function whose declared return is the full `Result<boolean,
string>` carrier must re-wrap it:

```cs
return Result<bool, string>.From2(result_AsErr);
```

The narrowed arm is not the same value as the full union carrier. The compiler
tracks that distinction by identity; it does not reverse-map narrowed temporary
names back to the original source variable and assume they are already the full
carrier.

Broad sinks such as `object?` do not force a runtime-union projection when the
actual emitted value has a direct CLR carrier. For example, a conditional whose
branches both emit `string[]` remains a direct array even if one semantic branch
was originally written as `string[] | undefined`.

## Language intrinsics

Use `@tsonic/core/lang.js` for language-facing helpers:

```ts
import {
  asinterface,
  defaultof,
  nameof,
  out,
  sizeof,
  stackalloc,
  trycast,
} from "@tsonic/core/lang.js";
```

## Generics and strictness

The compiler favors deterministic generic behavior over permissive
fallbacks. That means:

- no silent `any` escapes
- no hidden runtime retyping bridge
- explicit rejection where lowering is not supported

This strictness is why downstream verification is necessary: many regressions
show up only when real package graphs and emitted programs are exercised.
