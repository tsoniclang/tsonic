# Rust support inventory

This inventory describes the closed operation families proved by the Rust
target. Individual overloads remain governed by the active source-profile and
provider declarations.

## JavaScript families

- **Array:** literals, indexed access, `at`, length, push/pop, shift/unshift,
  splice, slice, concat, join, includes, index searches, reverse, default sort,
  fill, copyWithin, iteration, and callback forms of forEach, map, filter,
  reduce, some, every, find, and their index/last variants. Dense and sparse
  identity use the selected array carrier.
- **String:** length, case conversion, search predicates, index searches,
  slice/substring/substr/at, UTF-16 character/code-point operations, repeat,
  padding, trimming, normalization, concat, split, replace, replaceAll,
  search, match, matchAll, well-formedness, and static code-unit/code-point
  construction. Unrepresentable native-string results reject; explicit
  `JsString` preserves exact UTF-16.
- **RegExp:** literal and dynamic construction, ECMAScript grammar and flags,
  test, exec, match/matchAll, replace/replaceAll, search, split, writable
  `lastIndex`, groups, indices, callbacks, and well-known protocols.
- **Number and Math:** source-profile constants, conversions, formatting,
  parsing, predicates, trigonometric/hyperbolic/logarithmic functions,
  rounding, bit conversion, powers, random, and variadic min/max/hypot.
- **Collections:** Map/ReadonlyMap and Set/ReadonlySet construction, mutation,
  lookup, size, iteration, callbacks, insertion order, SameValueZero, and Set
  algebra.
- **Date:** constructors, now/parse/UTC, identity, ISO/UTC/JSON output, UTC
  getters, and UTC setters with JavaScript overflow and TimeClip rules.
- **Object and JSON:** closed structural keys/values/entries, own-property
  tests, selected spread/assignment shapes, JSON parse/stringify over finite
  broad-value graphs, replacer callbacks, and selected `toJSON` methods.
- **Execution:** console methods, promises, async/await, callbacks, errors,
  generators, resource management, timers, tuples, fixed arrays, records,
  generics, and selected typed-array families.

## Node families

- path and URL construction/manipulation;
- filesystem and filesystem-promise calls represented by the capability;
- process cwd/chdir/exit, argv/version/environment, executable identity,
  memory/timing metrics, and closed stdout/stderr sinks;
- Buffer allocation, sharing/copying, swaps, encoding, and the declared
  numeric read/write matrix;
- HTTP request/response operations with closed string and binary bodies;
- OS queries, crypto hashes/HMAC/random values, zlib, utilities, timers,
  assertions, and declared stream/sink operations;
- canonical `node:*` and supported bare aliases joined to one provider
  identity.

## Closed-world rejections

- `eval`, embedded engines, open reflection, and arbitrary dynamic member
  access;
- arbitrary `toJSON` dispatch when no exact selected method contract exists;
- projection or logging of unbounded arbitrary or cyclic object graphs.

## Check one Rust API

Import the exact native module and let rustdoc from the selected toolchain or
Cargo dependency answer the question:

```ts
import { HashMap } from "@tsonic/rust/std/collections.js";
import type { int32 } from "@tsonic/core/types.js";

export function make(): HashMap<string, int32> {
  return new HashMap<string, int32>();
}
```

For a third-party crate, replace the standard-library prefix with
`@tsonic/rust/crates/<direct-dependency-alias>/*`. Missing items, unsupported
signatures, foundation violations, and unresolved ownership reject at the
provider or analysis boundary. The documentation therefore lists metadata and
operation families rather than copying the evolving Rust API catalog.

## Rust target limits

- locale-sensitive string behavior requires one explicit ICU/data contract;
- local-time Date behavior requires one explicit timezone/data contract;
- open Node event schedulers such as unrestricted streams and `fs.watch`
  cannot be approximated without exact cancellation, ordering, backpressure,
  and resource-lifetime contracts;
- `Object.assign` cannot change the static layout of an existing Rust value;
- runtime-added fields, open nominal inspection, and unproved cyclic identity
  remain outside the finite carrier model.

For exact configuration and rejection rules, see
[configuration](configuration.md) and [limitations](limitations.md).
