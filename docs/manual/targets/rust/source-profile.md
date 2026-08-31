# Rust source profile and native APIs

Without `surfaces: ["js"]`, the Rust target uses its native source profile.

## Rust primitive aliases

```ts
import type { i32, i64, usize } from "@tsonic/rust/types.js";

export function selected(values: i64[], index: usize): i64 {
  return values[index];
}
```

Rust aliases retain exact source primitive facts. Portable source may instead
use `int32`, `int64`, and `nativeUint` from `@tsonic/core/types.js`.

## Standard-library virtual imports

The selected `foundation` controls which compiler-backed modules are legal:

```ts
import { Ordering } from "@tsonic/rust/core/cmp.js";
import { Vec } from "@tsonic/rust/alloc/vec.js";
import { HashMap } from "@tsonic/rust/std/collections.js";
```

The compiler-provider snapshots the selected Rust toolchain, obtains rustdoc
JSON, and exposes only requested public declarations. `core` source cannot
silently use `alloc` or `std`; an operation whose closed requirements exceed
the selected foundation is rejected before source publication.

## Third-party crates

Third-party crates use a user-owned Cargo project. The import names a direct
Cargo dependency alias and public module path:

```toml
[dependencies]
widget_alias = { package = "acme-widget", version = "1.2.3" }
```

```ts
import type { int32 } from "@tsonic/core/types.js";
import { Widget } from "@tsonic/rust/crates/widget_alias/index.js";

export function create(): Widget<int32> {
  return new Widget<int32>(42);
}
```

The provider resolves only direct dependencies from the immutable Cargo
snapshot. It preserves exact crate, module, item, generic, lifetime, const,
associated-type, safety, ABI, and fallibility identities. Unsupported rustdoc
signatures fail at the virtual import boundary.

## JavaScript surface

Select JavaScript semantics explicitly:

```json
{
  "targets": [{ "id": "rust", "surfaces": ["js"] }]
}
```

```ts
const values = [1, 2, 3];
console.log(values.map((value) => value * 2).join(","));
```

This activates the shared JS source profile and the Rust JS runtime. Native
Rust imports remain available when their foundation permits them.

See the exact [source-module reference](../../../reference/targets/rust/source-modules.md)
and [native-provider reference](../../../reference/targets/rust/native-apis.md).
