# Rust type mapping

The target maps exact source evidence and sealed ownership facts, not
TypeScript display names.

See [native numbers](../../native-numerics.md) for exact integer ranges,
numeric operations, literal handling and explicit truncation.

| Source contract | Rust representation |
| --- | --- |
| `boolean` / `bool` | `bool` |
| `int8`…`uint128` | matching Rust fixed-width integer |
| `nativeInt`, `nativeUint` | `isize`, `usize` |
| ordinary `bigint` | arbitrary-precision runtime `BigInt` |
| `float32`, `float64` | `f32`, `f64` |
| `string` | `String` or `&str` only when complete use analysis proves the ABI |
| `T | undefined` / selected nullable | `Option<T>` |
| mutable dense `T[]` | `Vec<T>` or selected JS array carrier |
| readonly array parameter | borrowed slice when the closed ABI proves it |
| homogeneous fixed tuple / `FixedArray<T, N>` | `[T; N]` when exact length and element carrier are proven |
| heterogeneous tuple | Rust tuple |
| `Ref<T, L>`, `Mut<T, L>` | `&'l T`, `&'l mut T` |
| `Pointer<T>` | `tsonic_rust_runtime::Location<T>` |
| `NativePointer<T>`, `constPtr<T>`, `mutPtr<T>` | native raw pointer with exact mutability |
| closed structural object | generated Rust record/enum/trait representation selected by layout policy |
| producer-owned broad value | finite `tsonic_rust_js::JsValue` carrier for proved operations |

Provider-backed values retain exact crate, module, item, generic, lifetime,
const, associated-type, ABI, safety, fallibility, and foundation identities.
No source type is silently boxed merely to make an unsupported operation
compile.

## Fixed arrays

The fixed-array carrier retains the exact extent as an integer constant in
`[T; N]`, including bigint source extents, without converting it through a
JavaScript number. Native `usize` representability and allocation limits remain
native constraints; exact emitted constants do not certify those constraints.

Source `.length` uses the native array's `usize` result, including arrays with
bigint source extents. It is not narrowed to `int32` or converted through a
floating-point value. An explicit `as int32` conversion checks the native range;
a declaration annotation does not silently narrow a native-word length.
Literal index/cardinality checks and rest bounds use exact counts, and iteration
retains native bounds. A representable extent alone does not guarantee that
an array can be allocated or that every fixed-array operation is supported.

The [shared layout contract](../../source-core.md#layout-and-raw-memory-source-contracts)
supports array metadata observations without materializing `[T; N]`, including
huge zero-sized arrays. Raw conversion and demanded backing support fixed arrays
of native `Copy` scalars and value records, including nested arrays, using the
declared element layout and stride. Reads produce independent `[T; N]` values;
writes preserve aliases to the raw region. Zero-sized elements require no
per-element memory operation, even for large exact extents. Reference-valued
elements and counts outside the selected address width remain rejections.

## Broad values

An `any` or `unknown` annotation does not select a general Rust carrier:

```ts
export function keep(value: unknown): unknown {
  return value;
}
```

This is rejected when the parameter must cross the Rust ABI without a concrete
carrier. Narrowing it first is ordinary TypeScript and produces a concrete
target type:

```ts
export function text(value: unknown): string {
  return typeof value === "string" ? value : "not text";
}
```

An approved producer can select a finite broad carrier. Under the JavaScript
surface, for example, `JSON.parse` produces `JsValue`; a matching JSON or JS
operation may consume that value. This is exact producer evidence, not a
spelling-based conversion from arbitrary `any`.

See [TypeScript types and utilities](../../typescript-types.md) for the pinned
utility inventory and the target-neutral `any` and `unknown` rules.
