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

The current compiler favors deterministic generic behavior over permissive
fallbacks. That means:

- no silent `any` escapes
- no hidden runtime retyping bridge
- explicit rejection where lowering is not supported

This strictness is why downstream verification is necessary: many regressions
show up only when real package graphs and emitted programs are exercised.
