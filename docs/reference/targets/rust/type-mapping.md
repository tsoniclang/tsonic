# Rust type mapping

The target maps exact source evidence and sealed ownership facts, not
TypeScript display names.

| Source contract | Rust representation |
| --- | --- |
| `boolean` / `bool` | `bool` |
| `int8`…`uint128` | matching Rust fixed-width integer |
| `nativeInt`, `nativeUint` | `isize`, `usize` |
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
