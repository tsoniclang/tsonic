# Mojo source modules

| Module | Purpose |
| --- | --- |
| `@tsonic/core/types.js` | Neutral numeric, pointer and shared semantic types. |
| `@tsonic/core/lang.js` | Shared operations such as `comptime`, `comptimeIf`, `unroll` and explicit unsafe regions. |
| `@tsonic/mojo/types.js` | Mojo numeric aliases and origin-bearing reference types. |
| `@tsonic/mojo/lang.js` | Mojo `copy` and `materialize` operations. |
| `node:*` | Installed Mojo Node capability declarations. |

The Mojo type aliases are `bool`, `i8`, `u8`, `i16`, `u16`, `i32`, `u32`,
`i64`, `u64`, `isize`, `usize`, `f16`, `f32` and `f64`.
The origin/reference declarations are `Origin`, `StaticOrigin`, `InferredOrigin`,
`UntrackedOrigin`, `UnsafeOrigin`, `Ref<T, O>` and `MutRef<T, O>`.

```ts
import type { i32 } from "@tsonic/mojo/types.js";
import { copy } from "@tsonic/mojo/lang.js";

export function twice(value: i32): i32 { return value * 2; }
export function duplicate(value: string): string { return copy(value); }
```

The modules are supplied through compiler extensions. Do not try to install
`@tsonic/mojo/types.js` as an npm package. Native package declarations use the
separate [compiler-backed provider](native-apis.md).
