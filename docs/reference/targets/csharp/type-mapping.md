# C# type mapping

The target maps exact source evidence, not TypeScript display names.

See [native numbers](../../native-numerics.md) for exact integer ranges,
numeric operations, literal handling and explicit truncation.

| Source contract | C# representation |
| --- | --- |
| `boolean` / `bool` | `bool` |
| `int8`…`uint64` | matching fixed-width CLR integer |
| `int128`, `uint128` | `Int128`, `UInt128` when selected |
| ordinary `bigint` | arbitrary-precision `System.Numerics.BigInteger` |
| `float32`, `float64`, `decimal` | `float`, `double`, `decimal` |
| `string` | `string` |
| `T | null`, `T | undefined`, `T | null | undefined` | nullable reference or `Nullable<T>` according to carrier |
| `T[]` | selected C# array/runtime carrier |
| tuple | C# tuple carrier |
| `Pointer<T>` | `Tsonic.CSharp.Runtime.Location<T>` |
| `NativePointer<T>` / `ptr<T>` | native `T*` when legal |
| `FunctionPointer<A, R>` / `fnptr<A, R>` | native function pointer or exact callable carrier |
| `FixedArray<T, N>` | ordinary `T[]` for admitted number-based extents; not inline fixed storage |
| closed structural object | generated immutable/mutable object-shape type as required |
| passive `any` / `unknown` | closed `Tsonic.CSharp.Runtime.TsValue` carrier |

Provider-backed types retain their provider-selected CLR identity, generic
arguments, nullability, render shape, and assembly relation. A source type that
cannot be reconciled with one exact target carrier is rejected before planning.

## Fixed arrays

C# admits fixed-array values with exact extents from `0` through
`2147483647`, retaining the ordinary array carrier, indexing, iteration and
signed 32-bit `.Length`. This is a representation bound, not a guarantee that
an allocation of that size succeeds. Numeric and bigint metadata literals select
the same native array: `FixedArray<T, 2>` and `FixedArray<T, 2n>` both expose
native signed 32-bit length results. Larger extents reject with
`CSHARP_FIXED_ARRAY_REPRESENTATION_UNSUPPORTED`.

The [shared layout contract](../../source-core.md#layout-and-raw-memory-source-contracts)
can describe exact array metadata, including huge zero-sized arrays, and
resolve compile-time size/alignment/stride observations without constructing a
C# array. Raw conversion and demanded physical backing support bounded fixed
arrays whose elements have an exact native scalar or value-record layout,
including nested arrays. The codec uses the declared element stride rather than
the CLR array's storage layout. Reads produce independent array snapshots;
writes update the original raw region. Reference-valued elements and the extent
restrictions above remain explicit rejections.

## Broad values

`TsValue` is a finite runtime sum, not C# `dynamic` and not reflection over an
arbitrary object:

```ts
export function keep(value: unknown): unknown {
  return value;
}
```

The parameter and result use `TsValue`. TypeScript still requires narrowing
before an `unknown` member can be read:

```ts
export function text(value: unknown): string {
  return typeof value === "string" ? value : "not text";
}
```

`any` removes that source check, but it only compiles when the selected member,
call, conversion, operator, or iteration has an implemented `TsValue`
operation. It never authorizes a late-bound CLR call by name.

See [TypeScript types and utilities](../../typescript-types.md) for the pinned
utility inventory and the target-neutral `any` and `unknown` rules.

## Absence

`null` and `undefined` are the same native absence, including on the JavaScript
and Node surfaces. A value that is absent compares equal to either spelling.
Zero, `false` and an empty string remain present values. Optional chaining and
`??` test absence without replacing these values.

There is no separate undefined runtime object or tag. For closed dynamic values,
string conversion renders absence as `"null"`, numeric conversion produces zero,
and `typeof` reports `"object"`. JSON writes a present absent-valued member as
`null`; it does not omit that member to imitate JavaScript undefined. A missing
dictionary key remains different from a present key holding JSON null. Use a
collection membership query when that distinction matters.
