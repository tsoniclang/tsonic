# Rust native APIs

Rust native declarations come from a compiler-backed provider, not a
hand-written standard-library surface.

## Standard library

| Prefix | Source | Minimum foundation |
| --- | --- | --- |
| `@tsonic/rust/core/*` | selected sysroot `core` rustdoc | `core` |
| `@tsonic/rust/alloc/*` | selected sysroot `alloc` rustdoc | `alloc` |
| `@tsonic/rust/std/*` | selected sysroot `std` rustdoc | `std` |

For example:

```ts
import { HashMap } from "@tsonic/rust/std/collections.js";
```

## Cargo dependencies

`@tsonic/rust/crates/<alias>/<module>.js` addresses a direct dependency alias
from the user-owned Cargo graph:

```ts
import { Client } from "@tsonic/rust/crates/acme_client/index.js";
```

The alias, not the crates.io package spelling, selects the dependency. This
preserves Cargo rename semantics and prevents source-name inference.

## Compiler-provider lifecycle

1. Cargo metadata and relevant source/toolchain inputs form one immutable
   compilation snapshot.
2. rustdoc JSON is materialized once for the selected sysroot or direct crate.
3. A module import requests one exact public module/export closure.
4. The provider projects representable declarations and exact target
   operation rows.
5. TSTS performs source checking against those declarations.
6. Rust analysis consumes selected identities and closes target carriers,
   generic arguments, ownership, fallibility, and dependencies.

The provider models functions, structs, enums, unions, traits, impls,
associated types, generic type/lifetime/const parameters, references, raw
pointers, function pointers, tuples, arrays, slices, ABI, variadics, safety,
trait bounds, and supported projections when rustdoc supplies enough exact
information. A signature outside that representable contract rejects at the
provider boundary.

## Snapshot invariants

Provider caches are keyed by immutable content identity. A changed Cargo
graph, toolchain, source crate, rustdoc artifact, feature set, or relevant
environment produces a different snapshot. Mutation during one compilation
fails closed; stale or corrupt cache data is never accepted as semantic input.
