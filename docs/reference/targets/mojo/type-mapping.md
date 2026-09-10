# Mojo type mapping

| TypeScript source | Native representation |
| --- | --- |
| `boolean`, `bool` | `Bool` |
| `number`, `f64` | `Float64` |
| `i8` / `u8` | `Int8` / `UInt8` |
| `i16` / `u16` | `Int16` / `UInt16` |
| `i32` / `u32` | `Int32` / `UInt32` |
| `i64` / `u64` | Exact 64-bit integer carriers; source values use `bigint`. |
| `isize` / `usize` | Native signed/unsigned machine-sized integer carriers. |
| `f16` / `f32` | `Float16` / `Float32` |
| `string` | Native Mojo `String`. |
| `void` return | No source return value. |

For example, changing `number` to `i32` changes the declared native API:

```ts
import type { i32 } from "@tsonic/mojo/types.js";

export function integerAdd(left: i32, right: i32): i32 {
  return left + right;
}
```

Its parameters and return type become `Int32`, not `Float64` with conversions.

Arrays, nullable values, records, callables and unions require closed selected
carriers. Do not assume an arbitrary TypeScript class becomes a plain Mojo value
struct, or that every array is a native `List`: aliasing and JavaScript surface
operations affect the representation. Provider signatures retain the exact
native carrier and parameter convention.
