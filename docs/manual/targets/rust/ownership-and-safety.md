# Rust ownership, lifetimes, and safety

## Inferred ordinary ownership

Ordinary TypeScript values require no Rust annotations:

```ts
export function append(values: string[], value: string): string[] {
  values.push(value);
  return values;
}
```

The closed source use graph determines whether Rust can borrow, move, copy, or
must own a value. The result is stored in the sealed Rust target program before
planning. The planner does not re-infer ownership from emitted syntax.

## Explicit native references

Use Rust source types only when an API contract itself distinguishes a borrow:

```ts
import type { int32 } from "@tsonic/core/types.js";
import type { Mut, Ref } from "@tsonic/rust/types.js";
import { load, mut, ref, store } from "@tsonic/rust/lang.js";

function increment(value: Mut<int32>): void {
  store(value, load(value) + 1);
}

function read(value: Ref<int32>): int32 {
  return load(value);
}

let value: int32 = 41;
increment(mut(value));
const answer = read(ref(value));
```

This emits zero-wrapper `&mut i32` and `&i32` references. `ref`, `mut`, `load`,
and `store` are exact Rust semantic operations, not runtime helper calls.

## Authored lifetimes

```ts
import type { int32 } from "@tsonic/core/types.js";
import type { Life, Outlives, Ref } from "@tsonic/rust/types.js";

export function choose<
  Short extends Life,
  Long extends Life & Outlives<Short>,
>(left: Ref<int32, Short>, _right: Ref<int32, Long>): Ref<int32, Short> {
  return left;
}
```

This expresses `fn choose<'short, 'long: 'short>(...) -> &'short i32`.
`Static` selects `'static`; `Placeholder` selects `'_`; omitted lifetime
arguments use Rust's legal call-scoped elision. Tsonic never inserts authored
lifetime types into ordinary TypeScript.

## Safe typed locations

```ts
let value: int32 = 1;
const location = addressOf(value);
storePointer(location, loadPointer(location) + 1);
```

`Pointer<T>` is a safe, identity-preserving location contract. Rust lowers it
to the closed `Location<T>` runtime carrier, not to `*const T` or `*mut T`.
Local, parameter, field, and index projections are accepted only when their
storage and alias identity are exact.

## Native pointers and explicit safety

```ts
import { loadNativePointer, unsafeContext } from "@tsonic/core/lang.js";
import type { NativePointer, int32 } from "@tsonic/core/types.js";

export function read(pointer: NativePointer<int32>): int32 {
  return unsafeContext(loadNativePointer(pointer));
}
```

The operation lowers to native pointer dereference inside an explicit Rust
`unsafe` expression or block. A native-pointer carrier, a requires-unsafe API
contract, and an unsafe use site are independent facts. None is inferred from
another.
