---
title: Diagnostics
---

# Diagnostics

Tsonic diagnostics are meant to stop unsupported lowering paths early.

## Common classes of failures

- unsupported dynamic typing
- unresolved source-package/package-graph issues
- unsupported generic or overload lowering
- explicit AOT rejection for constructs that cannot be lowered deterministically
- package-manifest or binding-metadata mismatches
- runtime/package ownership mismatches in multi-project workspaces

## Typical examples

### Surface mismatch

```ts
console.log("hello");
```

If the workspace is still on `clr`, this is a surface problem, not a random
typecheck accident. The fix is to switch the workspace surface to `@tsonic/js`
or use explicit CLR APIs.

### Package-graph mismatch

```ts
import * as fs from "node:fs";
```

If `@tsonic/nodejs` is not installed, the correct fix is package-graph setup,
not a local code workaround.

### Determinism failure

```ts
await import(specifier);
```

This fails because the import graph is no longer closed-world.

### Overload or generic ambiguity

```ts
Enumerable.Where(xs, (x) => x > 0);
```

When callback return or receiver shape is not specific enough, Tsonic reports
the ambiguity instead of guessing.

## How to debug

1. confirm the active surface
2. confirm package manifests and imports
3. inspect generated output with `tsonic generate`
4. reduce the failing construct to a minimal repro
5. rerun the smallest focused test or downstream case that exercises it

## Where to start fixing

- compiler diagnostics around parsing, typing, IR, or lowering -> start in
  `tsonic`
- authored source-package shape or runtime metadata -> start in `js`, `nodejs`,
  `express`, or your own source package
- CLR import or namespace projection issues -> start in `tsbindgen` or the
  generated binding repo

## Practical rule

Treat diagnostics as real architecture information.

The compiler is telling you one of these things:

- the surface is wrong
- the package graph is wrong
- the type information is not specific enough
- the construct cannot be lowered deterministically

The correct response is usually to fix the model, not to paper over the error
with a workaround.
