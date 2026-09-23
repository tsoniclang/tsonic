# Native numbers

C# and Rust use their native numeric types. Selecting the JavaScript or Node
surface does not change their integer ranges to JavaScript's range.

| TypeScript type | C# | Rust |
| --- | --- | --- |
| `number`, `float64` | `double` | `f64` |
| `float32` | `float` | `f32` |
| `int8` through `int64` | `sbyte` through `long` | `i8` through `i64` |
| `uint8` through `uint64` | `byte` through `ulong` | `u8` through `u64` |
| `int128`, `uint128` | `Int128`, `UInt128` | `i128`, `u128` |
| `nativeInt`, `nativeUint` | `nint`, `nuint` | `isize`, `usize` |
| unannotated `bigint` | `BigInteger` | runtime `BigInt` |

## Exact integers

```ts
import type { int64, uint64 } from "@tsonic/core/types.js";

const count: int64 = 9007199254740993n;
const maximum: uint64 = 18446744073709551615n;

export function retain(value: int64): int64 {
  return value;
}
```

`count` stays exact. It does not pass through a floating-point number or an
arbitrary-precision temporary. Width, signedness and native overflow rules
still matter. Values outside the selected integer range are not accepted as
integer literals.

`number` remains floating point. Converting an integer to `number` can lose
precision. `Number.MAX_SAFE_INTEGER` describes a binary64 precision boundary;
it is not a limit on `int64`, `uint64` or the other native integer types.

For a selected native integer literal, both targets read the exact token from
the checked AST's authored range. They do not recover integer values from a
rounded checker display string. Platform-sized constants keep native toolchain
range checking: Rust checks the typed literal, while C# uses a checked native
integer conversion. Neither target assumes the compiler host's pointer width.

## Integer operations

Use integer operands for bitwise operations and shifts:

```ts
import type { int32, int64 } from "@tsonic/core/types.js";

export function shift(value: int64, count: int32): int64 {
  return value << count;
}
```

Floating-point operands are not silently converted to 32-bit integers. Rust
uses native shift behavior, including its overflow-check settings. C# uses
its native shift behavior. Tsonic does not add JavaScript shift masks.

With the JavaScript surface, `Math.imul` explicitly requests a wrapping 32-bit
integer product. `Math.clz32` counts leading zero bits in a 32-bit integer.
Their inputs and results are `int32`; neither coerces a floating-point input.

## Explicit bit truncation

```ts
import type { int64 } from "@tsonic/core/types.js";

export function lowWord(value: bigint): int64 {
  return BigInt.asIntN(64, value);
}
```

The selected operation and constant width prove that this result fits `int64`.
The target reads the low bits directly into a native integer. It does not first
allocate a truncated BigInt. An unannotated `bigint` result remains arbitrary
precision.

A dynamic width or a result range that does not fit the destination cannot
use this implicit native result conversion. Bit counts must be finite,
non-negative integers. NaN and fractional widths are rejected, not coerced.

## Predicates and sizes

`Number.isInteger` and `Number.isSafeInteger` test integrality in the selected
native representation. All native integer values qualify, including values
above 2^53. Floating NaN, infinity and fractions do not. Native integer
arguments to these predicates do not convert to floating point.

Array and buffer allocation still obey native capacity and address-space
limits. Lengths must be non-negative integers; fractions, NaN and overflow
are errors. Allocation failure is not evidence that the integer itself is
outside a JavaScript-compatible range.

Node file reads and writes accept exact `int64` positions as well as ordinary
numeric positions. The `int64` path does not round through `number`. The native
OS and filesystem retain their own offset and file-size limits.
