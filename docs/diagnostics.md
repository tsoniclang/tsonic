# Diagnostics Guide

This page documents the current diagnostic categories and the most important active codes.

It is intentionally curated rather than a generated dump of every internal code path.

## Ranges

- `TSN1xxx` — module/import/resolution/config
- `TSN2xxx` — unsupported syntax or unrepresentable type constructs
- `TSN3xxx` — naming/emission conflicts
- `TSN5xxx` — numeric proof and backend/runtime generation errors
- `TSN6xxx` — yield lowering
- `TSN7xxx` — static/AOT safety and deterministic typing
- `TSN8Axx` — `tsonic.package.json`/source-package manifest/runtime mapping
- `TSN9xxx` — type universe and missing-core failures

## Common Active Diagnostics

### `TSN1004`

General module/package/config resolution failure.

Examples:

- invalid source package manifest
- unresolved export target in `tsonic.package.json`
- malformed installed package metadata

### `TSN2001`

Unsupported TypeScript feature in the current strict-AOT subset.

Current common cases:

- unsupported `import.meta` field
- unsupported dynamic `import()` form
- other syntax that does not have a deterministic lowering

### `TSN3001` / `TSN3002`

C# naming/identifier problems after lowering.

### `TSN5101`–`TSN5110`

Numeric proof failures.

Typical examples:

- narrowing `number` to `int` without proof
- branch results that do not prove an integer-space target
- value-space/range mismatches

### `TSN6101`

`yield` appeared in a position the lowering pipeline cannot rewrite.

Many direct and nested yield cases are now supported, but irreducible ones still fail with `TSN6101`.

### `TSN7203`

Dictionary/symbol-key lowering issue. Most useful symbol-key dictionary paths are now supported; remaining failures mean the key/value shape still is not representable.

### `TSN7401`

Explicit `any` is not supported.

### `TSN7403`

Object-literal case still requires a deterministic finite target shape or supported shorthand/runtime analysis.

### `TSN7414`

Type cannot be represented deterministically in the current lowering model.

### `TSN7418`

Invalid `char` value.

### `TSN7419`

`never` used as a generic type argument in an unsupported deterministic context.

### `TSN7432`

Generic function value usage is outside the supported monomorphic/runtime-shape subset.

Accepted examples do **not** produce this code:

```ts
const id = <T>(x: T): T => x;
const f: (x: number) => number = id;
```

Rejected examples do:

```ts
const id = <T>(x: T): T => x;
const copy = id;
```

### `TSN8A01`–`TSN8A05`

`tsonic.package.json`/source-package manifest errors:

- invalid schema
- unresolved runtime mapping
- conflicting runtime mapping
- missing bindings root
- missing runtime mapping entry

### `TSN9001` / `TSN9002`

Core type universe failures:

- missing required stdlib/core type
- unknown type leaked into later compilation

## Retired / No Longer Accurate Old Expectations

These old blanket statements are no longer true:

- `Promise.then/catch/finally` unsupported
- all dynamic `import()` unsupported
- all `import.meta` unsupported
- mapped/conditional/intersection types blanket-rejected
- object-literal method shorthand blanket-rejected

## Reading Diagnostics Correctly

Tsonic errors are emitted at compile time for authored TypeScript semantics, not deferred to C# where proof is expected earlier.

That is deliberate. The compiler should reject ambiguity before emission.
