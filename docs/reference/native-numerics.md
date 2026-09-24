# Native numbers

TypeScript supplies checked source types, not a JavaScript virtual machine.
C# and Rust retain their native numeric representations on every source surface.

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

These values stay exact. They do not pass through floating point or an
arbitrary-precision temporary. The selected native width, signedness and
overflow rules still apply. A literal outside its selected integer range
is rejected.

Selected native integer literals use the checked AST's exact authored token,
not a potentially rounded checker display string. Rust checks platform-sized
literals through its native compiler. C# retains a checked native-integer
conversion. Neither target assumes the compiler host's pointer width.

`number` remains floating point. An explicit conversion to `number` can lose
precision. `Number.MAX_SAFE_INTEGER` describes binary64 precision; it does
not limit native integer storage, arithmetic, API arguments or results.

## Native operations and JS APIs

Without a JS surface, use the selected target's APIs and semantics. Selecting
a JS or Node surface makes supported library operations available; it does
not replace native carriers, string encoding, ownership or allocation policy.

An explicitly selected JS API still means that operation, not whichever native
library operation happens to have the same name:

| Source operation | Supported behavior |
| --- | --- |
| `Math.min(NaN, 1)` | NaN, even where a native minimum function ignores NaN |
| `Math.round(-1.5)` | -1, with JS rounding and signed-zero rules |
| `Math.imul(a, b)` | Wrapping 32-bit product; floating inputs convert to low 32-bit words |
| `Math.clz32(a)` | Leading-zero count of the selected 32-bit word |
| `parseInt("123tail", 10)` | 123 |
| `parseFloat("1.5tail")` | 1.5 |
| `Number("")` | 0 |
| `Number("123tail")` | NaN: this conversion requires a complete numeric string |
| `BigInt("0xff")` | Exact arbitrary-precision 255 |
| `new Uint8Array([-1, 256])` | Elements 255 and 0 |
| `new Uint8ClampedArray([-1, 256])` | Elements 0 and 255 |
| `Date.UTC(99, 0, 1)` | Year 1999 |

For different native behavior, call the native API explicitly. Ordinary native
integer arithmetic does not acquire JS coercion. Floating-point operands to
integer bitwise operations are not silently converted to 32-bit integers.

```ts
import type { int32, int64 } from "@tsonic/core/types.js";

export function shift(value: int64, count: int32): int64 {
  return value << count;
}
```

Native shifts retain native overflow/masking behavior. The explicit `Math.imul`
and `Math.clz32` helpers do not redefine those operators. Their integer inputs
are not converted through floating point.

Small integer operations follow the target as well. Rust keeps the operand's
width for complement and shifts; C# promotes small integers to `int`. To
complement a byte at 32 bits on both targets, write `~(value as int32)`.

## Numeric text

On the JS surface, `toString()` retains integer receivers and their exact digits.
`toFixed`, `toExponential` and `toPrecision` provide the supported JS notation
and rounding rules. For example, `(12.5).toExponential(1)` produces
`"1.3e+1"`. Precision argument ranges belong to these APIs: fraction digits
range from 0 through 100; significant digits range from 1 through 100.

A native `int64` receiver containing `9007199254740993` prints
`"9007199254740993"`, not a rounded `double`. Integer radix formatting uses
native integers. Floating-point radix formatting outside the supported
decimal operation is rejected rather than approximated.

Parsing returns its declared result: `parseInt` produces a floating-point
`number`, not an exact native integer. Use `BigInt` or the target's native
integer parser when the result must retain every integer bit. Supported
whitespace, prefixes and invalid-input handling belong to the explicit API.

## Explicit bit truncation

```ts
import type { int64 } from "@tsonic/core/types.js";

export function lowWord(value: bigint): int64 {
  return BigInt.asIntN(64, value);
}
```

The selected operation and constant width prove the result fits `int64`.
The target reads those low bits directly into a native integer without an
intermediate truncated BigInt. An unannotated `bigint` result remains arbitrary
precision.

A dynamic or out-of-range width cannot prove an implicit native result
conversion. The public BigInt operation normalizes its width argument and
checks native capacity; the proven native-result helper validates its exact
compile-time width. No width is capped at 53 bits merely for JS compatibility.

## Queries, collections and storage

`Number.isInteger` tests the selected native value's integrality.
`Number.isSafeInteger` explicitly queries the JS Number precision domain.
It can return false for an exact `int64` without restricting that integer in
any way. Native integer arguments never round through floating point for
this query.

Native typed-array copies retain exact element carriers. Same-type copies use
native bulk copying. Different integer types convert directly; floating inputs
use the selected typed-array API's conversion. Overlapping views preserve the
source values required by the operation.

JS array `indexOf` does not match NaN; `includes`, Map and Set do. Ordinary
typed keys/searches avoid boxing. Explicit closed-value operations preserve
exact native integers rather than converting all values to double.

Array construction requires a non-negative integral length. Buffer and
typed-array APIs normalize their numeric length arguments, then validate the
native storage bounds. Allocation failure is not an artificial JS integer
limit. Split limits and formatting precision are API-specific arguments, not
a storage-carrier policy.

Date stores floating-point epoch milliseconds within its native signed
64-bit decomposition domain, rather than imposing the JS timestamp ceiling.
Native local-time libraries can support a narrower calendar range than UTC.

Node file reads and writes accept exact `int64` positions as well as ordinary
numeric positions. The `int64` path never rounds through `number`. Native OS
and filesystem limits still apply.

Compatibility is best effort within these representations. Unsupported
operations must reject precisely, not silently return a different result or
introduce a slow general fallback.
