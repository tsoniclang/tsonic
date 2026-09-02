# C# type mapping

The target maps exact source evidence, not TypeScript display names.

| Source contract | C# representation |
| --- | --- |
| `boolean` / `bool` | `bool` |
| `int8`…`uint64` | matching fixed-width CLR integer |
| `int128`, `uint128` | `Int128`, `UInt128` when selected |
| `float32`, `float64`, `decimal` | `float`, `double`, `decimal` |
| `string` | `string` |
| `T | undefined` / selected nullable | nullable reference or `Nullable<T>` according to carrier |
| `T[]` | selected C# array/runtime carrier |
| tuple | C# tuple carrier |
| `Pointer<T>` | `Tsonic.CSharp.Runtime.Location<T>` |
| `NativePointer<T>` / `ptr<T>` | native `T*` when legal |
| `FunctionPointer<A, R>` / `fnptr<A, R>` | native function pointer or exact callable carrier |
| `FixedArray<T, N>` | exact target fixed-storage representation selected by context |
| closed structural object | generated immutable/mutable object-shape type as required |
| passive `any` / `unknown` | closed `Tsonic.CSharp.Runtime.TsValue` carrier |

Provider-backed types retain their provider-selected CLR identity, generic
arguments, nullability, render shape, and assembly relation. A source type that
cannot be reconciled with one exact target carrier is rejected before planning.

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
