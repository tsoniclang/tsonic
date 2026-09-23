# Native numbers

C# and Rust use their native numeric types. Without a JavaScript surface,
semantics are entirely native. JavaScript and Node surfaces provide best-effort
compatibility, but native semantics and performance always take precedence.
Selecting either surface does not change native integer ranges to JavaScript's
range or authorize hidden emulation overhead.

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

The source is TypeScript, not a request to port JavaScript numeric semantics.
Each operation follows the selected native target. The JS/Node API surface
does not change that rule.

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

`Math.round`, `Math.sign`, `Math.min`, `Math.max` and `Math.pow` use native
operations too. For example, midpoint rounding follows `System.Math.Round`
on C# and `f64::round` on Rust; their answers can differ. Tsonic does not
insert branches to make either one agree with Node.

Typed-array and DataView element conversions use native narrowing: checked
CLR conversions on C#, Rust casts on Rust. Integer-to-integer conversions
retain the source integer type instead of passing through a float. The
explicit `Uint8ClampedArray` operation still requests clamping.

Indexes exposed as floating-point values use the target's native index
conversion. Range and from-end arithmetic then uses native integers. Counts
used for allocation, repetition, padding and split limits must be integral,
non-negative and within the target's storage domain. A fractional or invalid
count does not become zero or wrap modulo 2^32.

## Parsing and formatting

Numeric text uses the target's native parser and formatter. A malformed whole
token is not accepted merely because it starts with digits. `parseInt` parses
a signed 128-bit integer in the requested radix (decimal by default), then
returns the declared floating-point `number`. Use `BigInt` for an arbitrary-
precision integer result. Invalid tokens, radices and integer overflow produce
NaN. A radix must be an integer from 2 through 36; it does not wrap modulo 2^32.

`parseFloat` uses Rust's `f64` parser or C#'s invariant `double` parser. Native
whitespace and special-value rules apply. For example, Rust rejects leading
whitespace; C# permits it. Neither accepts `"12.5suffix"` as `12.5`.

`toString()` preserves the selected numeric width and uses native decimal
formatting. It does not change an exact integer to floating point to print it.
Native exponent spelling, signed zero and special-value text remain native:
Rust prints infinity as `inf`, while C# prints `Infinity`.

`toFixed(digits)` requests fixed-point formatting. `toExponential(digits)`
requests native exponential formatting. `toPrecision(precision)` uses C#'s
general numeric format; Rust uses exponential notation with the requested
significant digits. Without a precision, it uses ordinary native formatting.
The rounding rules belong to those native formatters. Integer receivers stay
integer-valued during formatting.

Counts must be integral and within the native formatter/storage limits.
There is no JavaScript precision cap of 100. Requesting a huge formatted
string can still exceed native memory or formatter limits.

`Number(text)` uses the same native parser as `parseFloat`. An empty string is
not zero. `BigInt(text)` uses native arbitrary-integer parsing; the explicit
`0x`, `0o` and `0b` prefixes select a radix. Whitespace and digit syntax follow
the target parser. For example, Rust's integer parser accepts underscores;
.NET's decimal integer parser does not.

Date timestamps are floating-point epoch milliseconds bounded by the native
signed 64-bit decomposition. They are not capped at JavaScript's timestamp
limit. `Date.UTC(99, 0, 1)` uses year 99, not 1999. Native local-time APIs can
have narrower calendar ranges than UTC timestamp storage.

Explicit closed-value operations retain native numeric carriers. C# uses its
native arithmetic promotion rules instead of first converting boxed integers
to double. Invalid mixed domains, such as decimal and double, need an explicit
conversion. Native collection equality also retains boxed numeric types: a
boxed `long` key is not a boxed `double` key. Ordinary typed operations do not
use closed-value dispatch.

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

`Number.isInteger` tests integrality in the selected native representation.
`Number.isSafeInteger` additionally tests a floating receiver's native exact-
integer precision: 53 bits for `double`/`f64`, 24 for `float`/`f32`, and 11
for C# `Half`. This explicit query does not limit storage or arithmetic.
All native integer values qualify, including values above 2^53; integer
arguments never convert to floating point for these predicates.

Array and buffer allocation still obey native capacity and address-space
limits. Lengths must be non-negative integers; fractions, NaN and overflow
are errors. Allocation failure is not evidence that the integer itself is
outside a JavaScript-compatible range.

Node file reads and writes accept exact `int64` positions as well as ordinary
numeric positions. The `int64` path does not round through `number`. The native
OS and filesystem retain their own offset and file-size limits.
