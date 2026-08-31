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
| `any` / `unknown` | closed `TsValue` carrier; never CLR reflection over arbitrary objects |

Provider-backed types retain their provider-selected CLR identity, generic
arguments, nullability, render shape, and assembly relation. A source type that
cannot be reconciled with one exact target carrier is rejected before planning.
