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

## Toolchain contract

Use Cargo, rustc, rustdoc and `rust-src` from the selected toolchain. Tsonic
invokes rustdoc's JSON mode internally; it does not require an editor or
rust-analyzer installation. Install the source component with
`rustup component add rust-src`.

The decoder supports rustdoc signature formats 57, 58, 59 and 60. These share
the native signature schema consumed by the provider. Unrecognized format
revisions fail at the provider boundary; a new Rust release is not assumed to
preserve that schema merely because its major version is unchanged.

## Snapshot and cache invariants

The snapshot records Cargo dependency identities, selected features, package
source digests and the actual compiler version. Dependency source is checked
before and after module extraction. A source change during a compilation is
rejected rather than combined with an earlier signature.

Nested directories with a valid `CACHEDIR.TAG` are declared caches, not package
source. Cargo tags its build directories, and the provider tags its own cache
root before writing requests or metadata. An invalid tag does not exclude a
directory. A selected Cargo package root is still read even if it has a tag.
Generated native source outside declared caches remains part of the snapshot.
Do not place required authored or generated input in a declared cache directory.

For example, a dependency's generated `src/lib.rs` remains an input, while its
tagged Cargo build directory may grow without changing the source digest.
Changing `src/lib.rs` invalidates the snapshot; writing a new object file in
the cache does not.

Rustdoc artifacts have content-digest markers tied to the snapshot and
dependency. Missing or corrupt artifacts are regenerated. The worker also
retains parsed documents, bounded to eight entries and 64 MiB of serialized
document weight. Reuse checks the artifact and marker identities and file
versions, including size, inode, modification time and change time. This avoids
repeated JSON parsing without skipping the native source checks. These cache
limits are not a bound on the entire compiler process or the standard-library
identity indexes.
