---
title: Language Intrinsics
---

# Language Intrinsics

Tsonic language intrinsics live in `@tsonic/core/lang.js`.

## Common intrinsics

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

## Why they exist

These intrinsics expose CLR/lowering-aware operations that TypeScript itself
does not model directly.

Examples:

- `nameof` for CLR-friendly name extraction
- `sizeof` for deterministic size queries
- `stackalloc` and `out` for CLR interop cases
- `asinterface` and `trycast` for explicit interface/cast intent

## Typical usage categories

### Name and shape helpers

- `nameof`
- `sizeof`
- `defaultof`

### CLR interop helpers

- `out`
- `stackalloc`
- `asinterface`
- `trycast`

### Attribute and overload metadata

The same module also carries language-facing marker DSL pieces used in CLR-heavy
codebases for attributes and overload families.
